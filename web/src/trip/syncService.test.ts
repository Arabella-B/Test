import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncSnapshot } from "./sync";
import type { Transaction } from "./types";

// A pretend Supabase "trip_vaults" table, so the whole sync process can be tested
// without a real account: create → another device connects → both change → sync.

interface Row { ciphertext: string; iv: string; salt: string; kdf_iterations: number; version: number; updated_at: string; device: string | null }
let row: Row | null = null;
let beforeUpdate: (() => void) | null = null; // lets a test simulate another device syncing at the same moment

vi.mock("../lib/supabase", () => {
  const table = {
    select: () => ({
      maybeSingle: async () => ({ data: row ? { ...row } : null, error: null }),
    }),
    insert: async (values: Partial<Row>) => {
      row = { version: 1, updated_at: new Date().toISOString(), device: null, ...values } as Row;
      return { error: null };
    },
    update: (values: Partial<Row>) => ({
      eq: (_col: string, version: number) => ({
        select: async () => {
          if (beforeUpdate) { const f = beforeUpdate; beforeUpdate = null; f(); }
          if (!row || row.version !== version) return { data: [], error: null };
          row = { ...row, ...values } as Row;
          return { data: [{ version: row.version }], error: null };
        },
      }),
    }),
    delete: () => ({ not: async () => { row = null; return { error: null }; } }),
  };
  return { supabase: { from: () => table } };
});

// Use fewer key-stretching rounds so the tests are quick.
vi.mock("./sync", async (original) => {
  const real = await original<typeof import("./sync")>();
  return { ...real, KDF_ITERATIONS: 1000 };
});

const { createVault, getVaultInfo, syncWithVault, unlockVault } = await import("./syncService");
const { WrongPassphraseError, decryptSnapshot, encryptSnapshot, mergeSnapshots } = await import("./sync");

const tx = (id: string): Transaction => ({
  id, date: "2027-02-01", description: id, merchant: id, amount: -100, categoryId: "eating_out", categorySource: "keyword",
  isForeign: false, source: "csv", importId: "i", dedupeKey: `key-${id}`,
});
const snap = (ids: string[]): SyncSnapshot => ({
  transactions: ids.map(tx), settings: null, checklist: null, rules: [], mappings: [], stops: [], budgets: [], cardEdits: {},
  modified: {}, deletedIds: [],
});

describe("sync process", () => {
  beforeEach(() => { row = null; beforeUpdate = null; });

  it("phone turns sync on, laptop connects with the same passphrase, and both end up with everything", async () => {
    const { key: phoneKey } = await createVault("purple tram mango river", snap(["phone-1"]));
    expect(row?.ciphertext).toBeTruthy();
    expect(row?.ciphertext).not.toContain("phone-1"); // stored encrypted

    const info = (await getVaultInfo())!;
    const laptopKey = await unlockVault("purple tram mango river", info);
    const laptopMerged = await syncWithVault(laptopKey, snap(["laptop-1"]));
    expect(laptopMerged.transactions.map((t) => t.id).sort()).toEqual(["laptop-1", "phone-1"]);

    const phoneMerged = await syncWithVault(phoneKey, snap(["phone-1", "phone-2"]));
    expect(phoneMerged.transactions.map((t) => t.id).sort()).toEqual(["laptop-1", "phone-1", "phone-2"]);
    expect(row?.version).toBe(3);
  });

  it("refuses to connect with the wrong passphrase", async () => {
    await createVault("purple tram mango river", snap(["a"]));
    const info = (await getVaultInfo())!;
    await expect(unlockVault("wrong passphrase!!", info)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("doesn't lose changes when two devices sync at the same moment", async () => {
    const { key } = await createVault("purple tram mango river", snap(["start"]));
    // Just before the phone uploads, the laptop sneaks in its own upload.
    beforeUpdate = () => {
      const current = row!;
      row ={ ...current, version: current.version + 1, ciphertext: laptopCipher.ciphertext, iv: laptopCipher.iv };
    };
    const laptopData = mergeSnapshots(snap(["laptop-x"]), await decryptSnapshot(row!.ciphertext, row!.iv, key));
    const laptopCipher = await encryptSnapshot(laptopData, key);

    const merged = await syncWithVault(key, snap(["phone-x"]));
    expect(merged.transactions.map((t) => t.id).sort()).toEqual(["laptop-x", "phone-x", "start"]);
    const stored = await decryptSnapshot(row!.ciphertext, row!.iv, key);
    expect(stored.transactions.map((t) => t.id).sort()).toEqual(["laptop-x", "phone-x", "start"]);
  });
});
