import { openDB, type IDBPDatabase } from "idb";
import type { ChecklistItem, ColumnMapping, MerchantRule, Transaction, TripSettings } from "./types";

// Private storage on THIS device only (IndexedDB, built into the browser).
// Nothing here is sent to the website, Supabase or anyone else.
// Each account (and the demo) gets its own separate database.

export interface TripData {
  transactions: Transaction[];
  settings: TripSettings | null;
  checklist: ChecklistItem[] | null;
  rules: MerchantRule[];
  mappings: ColumnMapping[];
}

type KvKey = "settings" | "checklist" | "rules" | "mappings";

export class TripDb {
  private db: Promise<IDBPDatabase>;

  constructor(scope: string) {
    this.db = openDB(`gap-year-trip-${scope}`, 1, {
      upgrade(db) {
        const txs = db.createObjectStore("transactions", { keyPath: "id" });
        txs.createIndex("date", "date");
        db.createObjectStore("kv");
      },
    });
  }

  async load(): Promise<TripData> {
    const db = await this.db;
    const [transactions, settings, checklist, rules, mappings] = await Promise.all([
      db.getAll("transactions") as Promise<Transaction[]>,
      db.get("kv", "settings"),
      db.get("kv", "checklist"),
      db.get("kv", "rules"),
      db.get("kv", "mappings"),
    ]);
    return { transactions, settings: settings ?? null, checklist: checklist ?? null, rules: rules ?? [], mappings: mappings ?? [] };
  }

  async putTransactions(list: Transaction[]): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("transactions", "readwrite");
    await Promise.all([...list.map((t) => tx.store.put(t)), tx.done]);
  }

  async deleteTransactions(ids: string[]): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("transactions", "readwrite");
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }

  async set(key: KvKey, value: unknown): Promise<void> {
    const db = await this.db;
    await db.put("kv", value, key);
  }

  async clear(): Promise<void> {
    const db = await this.db;
    await Promise.all([db.clear("transactions"), db.clear("kv")]);
  }
}

/** Ask the browser to keep this data even when the device is low on space. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
