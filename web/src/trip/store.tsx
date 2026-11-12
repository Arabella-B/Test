import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { categorise } from "./categorise";
import type { CardEdits } from "./countryInfo";
import { DEFAULT_CHECKLIST } from "./checklist";
import { TripDb, requestPersistentStorage, type TripData } from "./db";
import { demoBudgets, demoCash, demoRows, demoSettings, demoStops } from "./demo";
import { BUILT_IN_RATES, fetchRates, ratesAreStale, toPence, type FxRates } from "./fx";
import { buildImport, type ImportSummary } from "./importer";
import type { SyncSnapshot, SyncedKey } from "./sync";
import { addDays, today } from "./money";
import type {
  CategoryBudget, ChecklistItem, ColumnMapping, MerchantRule, ParsedRow, Transaction, TripSettings, TripStop,
} from "./types";

// Holds the private trip data in memory while the app is open, and saves every
// change straight to this device's storage.

export function defaultSettings(): TripSettings {
  const now = today();
  return {
    totalBudget: 0,
    budgetStartDate: now.slice(0, 8) + "01",
    departureDate: addDays(now, 28),
    returnDate: addDays(now, 28 + 150),
    familySupportMonthly: 0,
    familySenders: [],
    homeCurrency: "GBP",
  };
}

export interface CashEntry {
  date: string;
  localAmount: number; // in `currency`
  currency: string;
  categoryId: string;
  note: string;
}

interface TripContextValue {
  scope: string; // which account (or "demo") this data belongs to
  ready: boolean;
  isDemo: boolean;
  transactions: Transaction[];
  settings: TripSettings;
  hasSettings: boolean;
  checklist: ChecklistItem[];
  rules: MerchantRule[];
  mappings: ColumnMapping[];
  stops: TripStop[];
  budgets: CategoryBudget[];
  cardEdits: CardEdits;
  fx: FxRates;
  importRows(rows: ParsedRow[], source: Transaction["source"]): Promise<ImportSummary>;
  /** Log cash spending by hand. Returns true if this switched on cash tracking. */
  addCash(entry: CashEntry): Promise<boolean>;
  setCategory(id: string, categoryId: string, applyToMerchant: boolean): Promise<number>;
  deleteTransaction(id: string): Promise<void>;
  saveSettings(settings: TripSettings): Promise<void>;
  saveChecklist(items: ChecklistItem[]): Promise<void>;
  saveMapping(mapping: ColumnMapping): Promise<void>;
  saveStops(stops: TripStop[]): Promise<void>;
  saveBudgets(budgets: CategoryBudget[]): Promise<void>;
  saveCardEdits(edits: CardEdits): Promise<void>;
  refreshRates(): Promise<boolean>;
  markBackedUp(): Promise<void>;
  exportData(): TripData;
  replaceAll(data: TripData): Promise<void>;
  clearAll(): Promise<void>;
  /** For sync: everything, plus when each part last changed and what was deleted. */
  snapshot(): SyncSnapshot;
  applySnapshot(snapshot: SyncSnapshot): Promise<void>;
  db: TripDb;
}

const TripContext = createContext<TripContextValue | null>(null);

const EMPTY: TripData = { transactions: [], settings: null, checklist: null, rules: [], mappings: [], stops: [], budgets: [], cardEdits: {} };

export function TripProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const isDemo = scope === "demo";
  const db = useMemo(() => new TripDb(scope), [scope]);
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<TripSettings>(defaultSettings);
  const [hasSettings, setHasSettings] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [rules, setRules] = useState<MerchantRule[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [stops, setStops] = useState<TripStop[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [cardEdits, setCardEdits] = useState<CardEdits>({});
  const [fx, setFx] = useState<FxRates>(BUILT_IN_RATES);
  const [modified, setModified] = useState<Partial<Record<SyncedKey, string>>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  /** Remember when a part of your data last changed (so syncing knows which copy is newer). */
  const touch = useCallback(async (key: SyncedKey) => {
    const at = new Date().toISOString();
    let next: Partial<Record<SyncedKey, string>> = {};
    setModified((prev) => (next = { ...prev, [key]: at }));
    await db.set("modified", { ...(await db.get<Partial<Record<SyncedKey, string>>>("modified")), [key]: at });
    return next;
  }, [db]);

  const apply = useCallback((data: TripData) => {
    setTransactions(data.transactions);
    setSettings(data.settings ?? defaultSettings());
    setHasSettings(!!data.settings);
    setChecklist(data.checklist ?? DEFAULT_CHECKLIST);
    setRules(data.rules);
    setMappings(data.mappings);
    setStops(data.stops);
    setBudgets(data.budgets);
    setCardEdits(data.cardEdits);
  }, []);

  const refreshRates = useCallback(async () => {
    const fresh = await fetchRates();
    if (!fresh) return false;
    setFx(fresh);
    await db.set("fx", fresh);
    return true;
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data = await db.load();
      // First time in the demo: fill it with Alex's made-up data.
      if (isDemo && data.transactions.length === 0) {
        const s = demoSettings();
        const result = buildImport(demoRows(), new Set(), { rules: [], familySenders: s.familySenders, source: "demo", importId: "demo" });
        const checklist = DEFAULT_CHECKLIST.map((c) => ({ ...c, done: ["clinic", "passport", "visas", "insurance", "card"].includes(c.id) }));
        // Fixed ids make this safe to run twice (React may start effects twice in development).
        await db.putTransactions([
          ...result.added.map((t) => ({ ...t, id: `demo-${t.dedupeKey}` })),
          ...demoCash(BUILT_IN_RATES),
        ]);
        await db.set("settings", s);
        await db.set("checklist", checklist);
        await db.set("stops", demoStops());
        await db.set("budgets", demoBudgets());
        data = await db.load();
      }
      const savedRates = await db.loadRates();
      const savedModified = (await db.get<Partial<Record<SyncedKey, string>>>("modified")) ?? {};
      const savedDeleted = (await db.get<string[]>("deletedIds")) ?? [];
      if (cancelled) return;
      apply(data);
      setModified(savedModified);
      setDeletedIds(savedDeleted);
      if (savedRates) setFx(savedRates);
      setReady(true);
      // Fetch fresh exchange rates in the background when online.
      if (!savedRates || ratesAreStale(savedRates)) void refreshRates();
    })();
    return () => { cancelled = true; };
  }, [db, isDemo, apply, refreshRates]);

  const importRows = useCallback(async (rows: ParsedRow[], source: Transaction["source"]) => {
    const existing = new Set(transactions.map((t) => t.dedupeKey));
    const summary = buildImport(rows, existing, {
      rules, familySenders: settings.familySenders, source, importId: crypto.randomUUID(),
    });
    await db.putTransactions(summary.added);
    setTransactions((prev) => [...prev, ...summary.added]);
    if (!isDemo) void requestPersistentStorage();
    return summary;
  }, [db, transactions, rules, settings.familySenders, isDemo]);

  const addCash = useCallback(async (entry: CashEntry) => {
    const id = crypto.randomUUID();
    const pence = toPence(entry.localAmount, entry.currency, fx);
    const label = entry.note.trim() || "Cash";
    const t: Transaction = {
      id,
      date: entry.date,
      description: `Cash: ${label}`,
      merchant: label.toUpperCase(),
      amount: -Math.abs(pence),
      categoryId: entry.categoryId,
      categorySource: "user",
      isForeign: entry.currency !== "GBP",
      source: "manual",
      importId: "manual",
      dedupeKey: `manual-${id}`,
      currency: entry.currency,
      localAmount: Math.abs(entry.localAmount),
      note: entry.note.trim() || undefined,
    };
    await db.putTransactions([t]);
    setTransactions((prev) => [...prev, t]);
    if (!settings.trackCashSpending) {
      // From now on, ATM withdrawals aren't counted as spending (no double counting).
      const next = { ...settings, trackCashSpending: true };
      setSettings(next);
      await db.set("settings", next);
      return true;
    }
    return false;
  }, [db, fx, settings]);

  const setCategory = useCallback(async (id: string, categoryId: string, applyToMerchant: boolean) => {
    const target = transactions.find((t) => t.id === id);
    if (!target) return 0;
    const changed = transactions
      .filter((t) => t.id === id || (applyToMerchant && t.merchant === target.merchant))
      .map((t) => ({ ...t, categoryId, categorySource: "user" as const, updatedAt: new Date().toISOString() }));
    await db.putTransactions(changed);
    const byId = new Map(changed.map((t) => [t.id, t]));
    setTransactions((prev) => prev.map((t) => byId.get(t.id) ?? t));
    if (applyToMerchant) {
      // Remember this as a rule for future imports.
      const next = [...rules.filter((r) => r.merchant !== target.merchant), { merchant: target.merchant, categoryId }];
      setRules(next);
      await db.set("rules", next);
      await touch("rules");
    }
    return changed.length;
  }, [db, transactions, rules, touch]);

  const deleteTransaction = useCallback(async (id: string) => {
    await db.deleteTransactions([id]);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    const next = [...deletedIds, id];
    setDeletedIds(next);
    await db.set("deletedIds", next);
  }, [db, deletedIds]);

  const saveSettings = useCallback(async (next: TripSettings) => {
    await db.set("settings", next);
    setSettings(next);
    setHasSettings(true);
    await touch("settings");
    // Family names may have changed: re-check money coming in that isn't set by you.
    const updated = transactions
      .filter((t) => t.amount > 0 && t.categorySource !== "user")
      .map((t) => {
        const r = categorise(t.description, t.amount, { rules, familySenders: next.familySenders });
        return r.categoryId !== t.categoryId ? { ...t, categoryId: r.categoryId, categorySource: r.source } : null;
      })
      .filter((t): t is Transaction => t !== null);
    if (updated.length) {
      await db.putTransactions(updated);
      const byId = new Map(updated.map((t) => [t.id, t]));
      setTransactions((prev) => prev.map((t) => byId.get(t.id) ?? t));
    }
  }, [db, transactions, rules, touch]);

  const saveChecklist = useCallback(async (items: ChecklistItem[]) => {
    setChecklist(items);
    await db.set("checklist", items);
    await touch("checklist");
  }, [db, touch]);

  const saveMapping = useCallback(async (mapping: ColumnMapping) => {
    const next = [...mappings.filter((m) => m.signature !== mapping.signature), mapping];
    setMappings(next);
    await db.set("mappings", next);
    await touch("mappings");
  }, [db, mappings, touch]);

  const saveStops = useCallback(async (next: TripStop[]) => {
    setStops(next);
    await db.set("stops", next);
    await touch("stops");
  }, [db, touch]);

  const saveBudgets = useCallback(async (next: CategoryBudget[]) => {
    setBudgets(next);
    await db.set("budgets", next);
    await touch("budgets");
  }, [db, touch]);

  const saveCardEdits = useCallback(async (next: CardEdits) => {
    setCardEdits(next);
    await db.set("cardEdits", next);
    await touch("cardEdits");
  }, [db, touch]);

  const markBackedUp = useCallback(async () => {
    const next = { ...settings, lastBackupAt: new Date().toISOString() };
    setSettings(next);
    await db.set("settings", next);
  }, [db, settings]);

  const exportData = useCallback(
    (): TripData => ({ transactions, settings: hasSettings ? settings : null, checklist, rules, mappings, stops, budgets, cardEdits }),
    [transactions, settings, hasSettings, checklist, rules, mappings, stops, budgets, cardEdits],
  );

  const replaceAll = useCallback(async (data: TripData) => {
    // Keep things that aren't part of your data: saved exchange rates and the sync key.
    const keep = await Promise.all((["fx", "syncKey", "syncInfo"] as const).map(async (k) => [k, await db.get(k)] as const));
    await db.clear();
    for (const [k, v] of keep) if (v !== undefined) await db.set(k, v);
    await db.putTransactions(data.transactions);
    if (data.settings) await db.set("settings", data.settings);
    if (data.checklist) await db.set("checklist", data.checklist);
    await db.set("rules", data.rules);
    await db.set("mappings", data.mappings);
    await db.set("stops", data.stops);
    await db.set("budgets", data.budgets);
    await db.set("cardEdits", data.cardEdits);
    apply(data);
  }, [db, apply]);

  const clearAll = useCallback(async () => {
    await db.clear();
    apply(EMPTY);
  }, [db, apply]);

  const snapshot = useCallback(
    (): SyncSnapshot => ({ ...exportData(), modified, deletedIds }),
    [exportData, modified, deletedIds],
  );

  const applySnapshot = useCallback(async (snap: SyncSnapshot) => {
    const { modified: m, deletedIds: d, ...data } = snap;
    await replaceAll(data);
    await db.set("modified", m);
    await db.set("deletedIds", d);
    setModified(m);
    setDeletedIds(d);
  }, [db, replaceAll]);

  const value: TripContextValue = {
    scope, ready, isDemo, transactions, settings, hasSettings, checklist, rules, mappings, stops, budgets, cardEdits, fx,
    importRows, addCash, setCategory, deleteTransaction, saveSettings, saveChecklist, saveMapping, saveStops, saveBudgets, saveCardEdits,
    refreshRates, markBackedUp, exportData, replaceAll, clearAll, snapshot, applySnapshot, db,
  };
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip must be used inside TripProvider");
  return value;
}
