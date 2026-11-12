import { supabase } from "../lib/supabase";
import { KDF_ITERATIONS, decryptSnapshot, deriveKey, encryptSnapshot, mergeSnapshots, newSalt, type SyncSnapshot } from "./sync";

// Talks to Supabase for sync. Only encrypted data ever leaves the device.

interface VaultRow {
  ciphertext: string;
  iv: string;
  salt: string;
  kdf_iterations: number;
  version: number;
  updated_at: string;
  device: string | null;
}

export interface VaultInfo {
  salt: string;
  iterations: number;
  updatedAt: string;
  device: string | null;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows computer";
  return "Another device";
}

/** Is there a synced copy for this account? (Doesn't need the passphrase.) */
export async function getVaultInfo(): Promise<VaultInfo | null> {
  const { data, error } = await supabase.from("trip_vaults").select("salt,kdf_iterations,updated_at,device").maybeSingle();
  if (error) throw new Error("Couldn't reach the sync service. Check your connection.");
  return data ? { salt: data.salt, iterations: data.kdf_iterations, updatedAt: data.updated_at, device: data.device } : null;
}

/** Start syncing with a new passphrase: make a key and upload the first encrypted copy. */
export async function createVault(passphrase: string, snapshot: SyncSnapshot): Promise<{ key: CryptoKey; salt: string; iterations: number }> {
  const salt = newSalt();
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const sealed = await encryptSnapshot(snapshot, key);
  const { error } = await supabase.from("trip_vaults").insert({
    ciphertext: sealed.ciphertext, iv: sealed.iv, salt, kdf_iterations: KDF_ITERATIONS, device: deviceName(),
  });
  if (error) throw new Error("Couldn't turn on sync. Please try again.");
  return { key, salt, iterations: KDF_ITERATIONS };
}

/** Connect this device to an existing synced copy. Throws WrongPassphraseError if it doesn't match. */
export async function unlockVault(passphrase: string, info: VaultInfo): Promise<CryptoKey> {
  const key = await deriveKey(passphrase, info.salt, info.iterations);
  const row = await fetchRow();
  if (row) await decryptSnapshot(row.ciphertext, row.iv, key); // proves the passphrase is right
  return key;
}

async function fetchRow(): Promise<VaultRow | null> {
  const { data, error } = await supabase.from("trip_vaults").select("ciphertext,iv,salt,kdf_iterations,version,updated_at,device").maybeSingle();
  if (error) throw new Error("Couldn't reach the sync service. Check your connection.");
  return data as VaultRow | null;
}

/**
 * Sync: download the encrypted copy, merge it with this device's data, and upload the
 * result. Uses the version number so two devices syncing at the same moment don't
 * overwrite each other (the second one merges again and retries).
 */
export async function syncWithVault(key: CryptoKey, local: SyncSnapshot): Promise<SyncSnapshot> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await fetchRow();
    if (!row) throw new Error("Your synced copy was deleted. Turn sync on again to create a new one.");
    const remote = await decryptSnapshot(row.ciphertext, row.iv, key);
    const merged = mergeSnapshots(local, remote);
    const sealed = await encryptSnapshot(merged, key);
    const { data, error } = await supabase
      .from("trip_vaults")
      .update({ ciphertext: sealed.ciphertext, iv: sealed.iv, version: row.version + 1, device: deviceName(), updated_at: new Date().toISOString() })
      .eq("version", row.version)
      .select("version");
    if (error) throw new Error(/payload|too large|exceeded/i.test(error.message) ? "Your data is too big to sync." : "Couldn't upload. Check your connection.");
    if (data && data.length > 0) return merged;
    local = merged; // someone else synced in between: merge with their copy and try again
  }
  throw new Error("Another device is syncing right now. Try again in a moment.");
}

export async function deleteVault(): Promise<void> {
  const { error } = await supabase.from("trip_vaults").delete().not("user_id", "is", null);
  if (error) throw new Error("Couldn't delete the synced copy. Please try again.");
}
