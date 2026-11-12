import { fromB64, toB64 } from "./lock";
import type { TripData } from "./db";
import type { Transaction } from "./types";

// Encrypted sync between your devices.
//
// 1. Your sync passphrase is turned into an encryption key ON YOUR DEVICE
//    (PBKDF2, 600,000 rounds, with a random salt). The passphrase never leaves the device.
// 2. Your My Trip data is compressed and encrypted with AES-256-GCM before upload.
//    Supabase only stores the scrambled result; nobody without the passphrase can read it.
// 3. When two devices both changed things, their copies are MERGED (see mergeSnapshots).
//
// If you forget the passphrase, the synced copy can't be recovered, but each
// device still has its own copy.

export const KDF_ITERATIONS = 600_000;

/** Which kinds of data the merge compares by "last changed" time. */
export const SYNCED_KEYS = ["settings", "checklist", "rules", "mappings", "stops", "budgets", "cardEdits"] as const;
export type SyncedKey = (typeof SYNCED_KEYS)[number];

/** Everything that gets synced: your data plus a little bookkeeping for merging. */
export interface SyncSnapshot extends TripData {
  modified: Partial<Record<SyncedKey, string>>; // when each part was last changed (ISO)
  deletedIds: string[]; // transactions you deleted, so they don't come back from another device
}

// ---- Keys ----

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

/** Turn a passphrase into an AES key. The key can't be exported or read back out. */
export async function deriveKey(passphrase: string, salt: string, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---- Compress + encrypt ----

async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export async function encryptSnapshot(snapshot: SyncSnapshot, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await gzip(JSON.stringify(snapshot));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed);
  return { ciphertext: toB64(sealed), iv: toB64(iv) };
}

/** Decrypt. Throws WrongPassphraseError if the key is wrong (or the data was tampered with). */
export async function decryptSnapshot(ciphertext: string, iv: string, key: CryptoKey): Promise<SyncSnapshot> {
  let opened: ArrayBuffer;
  try {
    opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ciphertext));
  } catch {
    throw new WrongPassphraseError();
  }
  return normalise(JSON.parse(await gunzip(new Uint8Array(opened))));
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase doesn't match your synced data.");
  }
}

function normalise(s: Partial<SyncSnapshot>): SyncSnapshot {
  return {
    transactions: s.transactions ?? [],
    settings: s.settings ?? null,
    checklist: s.checklist ?? null,
    rules: s.rules ?? [],
    mappings: s.mappings ?? [],
    stops: s.stops ?? [],
    budgets: s.budgets ?? [],
    cardEdits: s.cardEdits ?? {},
    modified: s.modified ?? {},
    deletedIds: s.deletedIds ?? [],
  };
}

// ---- Merge ----

/**
 * Combine two devices' copies.
 * - Transactions: kept from both. If the same one was edited on both, the later edit wins.
 *   Deleted ones stay deleted. The same statement imported on both devices isn't duplicated.
 * - Settings, route, budgets, checklist, rules, column choices, card edits: whichever device
 *   changed that part most recently wins.
 */
export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  const deleted = new Set([...local.deletedIds, ...remote.deletedIds]);

  const byId = new Map<string, Transaction>();
  for (const t of [...remote.transactions, ...local.transactions]) {
    if (deleted.has(t.id)) continue;
    const other = byId.get(t.id);
    if (!other || (t.updatedAt ?? "") >= (other.updatedAt ?? "")) byId.set(t.id, t);
  }
  // Same statement imported on both devices: same dedupe key, different ids. Keep one.
  const byKey = new Map<string, Transaction>();
  for (const t of [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const existing = byKey.get(t.dedupeKey);
    if (!existing) byKey.set(t.dedupeKey, t);
    else if ((t.updatedAt ?? "") > (existing.updatedAt ?? "")) byKey.set(t.dedupeKey, t);
  }

  const merged: SyncSnapshot = { ...local, transactions: [...byKey.values()], deletedIds: [...deleted], modified: { ...local.modified } };
  for (const key of SYNCED_KEYS) {
    const mine = local.modified[key] ?? "";
    const theirs = remote.modified[key] ?? "";
    if (theirs > mine) {
      (merged as unknown as Record<string, unknown>)[key] = remote[key];
      merged.modified[key] = theirs;
    }
  }
  return merged;
}
