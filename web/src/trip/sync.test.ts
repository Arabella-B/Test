import { describe, expect, it } from "vitest";
import { WrongPassphraseError, decryptSnapshot, deriveKey, encryptSnapshot, mergeSnapshots, newSalt, type SyncSnapshot } from "./sync";
import type { Transaction, TripStop } from "./types";

const tx = (id: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, date: "2027-02-01", description: id, merchant: id, amount: -100, categoryId: "eating_out", categorySource: "keyword",
  isForeign: false, source: "csv", importId: "i", dedupeKey: `key-${id}`, ...extra,
});

const snap = (extra: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  transactions: [], settings: null, checklist: null, rules: [], mappings: [], stops: [], budgets: [], cardEdits: {},
  modified: {}, deletedIds: [], ...extra,
});

const stop = (country: string): TripStop => ({ id: country, country, flag: "", currency: "THB", startDate: "2027-02-01", endDate: "2027-02-10", dailyBudget: 3000 });

describe("encryption", () => {
  // Fewer rounds in tests so they run quickly; the app uses 600,000.
  const ROUNDS = 1000;

  it("encrypts and decrypts with the right passphrase", async () => {
    const salt = newSalt();
    const key = await deriveKey("correct horse battery staple", salt, ROUNDS);
    const data = snap({ transactions: [tx("a")], stops: [stop("Thailand")] });
    const sealed = await encryptSnapshot(data, key);
    expect(sealed.ciphertext).not.toContain("Thailand"); // unreadable without the key
    const opened = await decryptSnapshot(sealed.ciphertext, sealed.iv, key);
    expect(opened.stops[0].country).toBe("Thailand");
    expect(opened.transactions).toHaveLength(1);
  });

  it("refuses the wrong passphrase", async () => {
    const salt = newSalt();
    const sealed = await encryptSnapshot(snap(), await deriveKey("right passphrase", salt, ROUNDS));
    const wrongKey = await deriveKey("wrong passphrase", salt, ROUNDS);
    await expect(decryptSnapshot(sealed.ciphertext, sealed.iv, wrongKey)).rejects.toBeInstanceOf(WrongPassphraseError);
  });
});

describe("merging two devices", () => {
  it("keeps new transactions from both devices", () => {
    const merged = mergeSnapshots(snap({ transactions: [tx("phone")] }), snap({ transactions: [tx("laptop")] }));
    expect(merged.transactions.map((t) => t.id).sort()).toEqual(["laptop", "phone"]);
  });

  it("keeps the later edit when the same transaction changed on both", () => {
    const local = snap({ transactions: [tx("a", { categoryId: "groceries", updatedAt: "2027-02-02T10:00:00Z" })] });
    const remote = snap({ transactions: [tx("a", { categoryId: "gifts", updatedAt: "2027-02-03T10:00:00Z" })] });
    expect(mergeSnapshots(local, remote).transactions[0].categoryId).toBe("gifts");
    expect(mergeSnapshots(remote, local).transactions[0].categoryId).toBe("gifts");
  });

  it("keeps deleted transactions deleted", () => {
    const local = snap({ transactions: [], deletedIds: ["a"] });
    const remote = snap({ transactions: [tx("a"), tx("b")] });
    expect(mergeSnapshots(local, remote).transactions.map((t) => t.id)).toEqual(["b"]);
  });

  it("doesn't duplicate a statement imported on both devices", () => {
    const local = snap({ transactions: [tx("x1", { dedupeKey: "2027-02-01|-100|LIDL|1" })] });
    const remote = snap({ transactions: [tx("y9", { dedupeKey: "2027-02-01|-100|LIDL|1" })] });
    expect(mergeSnapshots(local, remote).transactions).toHaveLength(1);
  });

  it("takes the most recently changed route, budgets and settings", () => {
    const local = snap({ stops: [stop("Peru")], modified: { stops: "2027-01-05T00:00:00Z", budgets: "2027-01-09T00:00:00Z" }, budgets: [{ categoryId: "eating_out", monthly: 100 }] });
    const remote = snap({ stops: [stop("Bolivia")], modified: { stops: "2027-01-07T00:00:00Z", budgets: "2027-01-01T00:00:00Z" }, budgets: [] });
    const merged = mergeSnapshots(local, remote);
    expect(merged.stops[0].country).toBe("Bolivia"); // remote changed the route later
    expect(merged.budgets).toHaveLength(1); // local changed budgets later
    expect(merged.modified.stops).toBe("2027-01-07T00:00:00Z");
  });
});
