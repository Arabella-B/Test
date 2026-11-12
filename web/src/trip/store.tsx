import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { categorise } from "./categorise";
import { DEFAULT_CHECKLIST } from "./checklist";
import { TripDb, requestPersistentStorage, type TripData } from "./db";
import { demoRows, demoSettings } from "./demo";
import { buildImport, type ImportSummary } from "./importer";
import { addDays, today } from "./money";
import type { ChecklistItem, ColumnMapping, MerchantRule, ParsedRow, Transaction, TripSettings } from "./types";

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

interface TripContextValue {
  ready: boolean;
  isDemo: boolean;
  transactions: Transaction[];
  settings: TripSettings;
  hasSettings: boolean;
  checklist: ChecklistItem[];
  rules: MerchantRule[];
  mappings: ColumnMapping[];
  importRows(rows: ParsedRow[], source: Transaction["source"]): Promise<ImportSummary>;
  setCategory(id: string, categoryId: string, applyToMerchant: boolean): Promise<number>;
  deleteTransaction(id: string): Promise<void>;
  saveSettings(settings: TripSettings): Promise<void>;
  saveChecklist(items: ChecklistItem[]): Promise<void>;
  saveMapping(mapping: ColumnMapping): Promise<void>;
  markBackedUp(): Promise<void>;
  exportData(): TripData;
  replaceAll(data: TripData): Promise<void>;
  clearAll(): Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

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

  const apply = useCallback((data: TripData) => {
    setTransactions(data.transactions);
    setSettings(data.settings ?? defaultSettings());
    setHasSettings(!!data.settings);
    setChecklist(data.checklist ?? DEFAULT_CHECKLIST);
    setRules(data.rules);
    setMappings(data.mappings);
  }, []);

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
        await db.putTransactions(result.added.map((t) => ({ ...t, id: `demo-${t.dedupeKey}` })));
        await db.set("settings", s);
        await db.set("checklist", checklist);
        data = await db.load();
      }
      if (!cancelled) { apply(data); setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [db, isDemo, apply]);

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

  const setCategory = useCallback(async (id: string, categoryId: string, applyToMerchant: boolean) => {
    const target = transactions.find((t) => t.id === id);
    if (!target) return 0;
    const changed = transactions
      .filter((t) => t.id === id || (applyToMerchant && t.merchant === target.merchant))
      .map((t) => ({ ...t, categoryId, categorySource: "user" as const }));
    await db.putTransactions(changed);
    const byId = new Map(changed.map((t) => [t.id, t]));
    setTransactions((prev) => prev.map((t) => byId.get(t.id) ?? t));
    if (applyToMerchant) {
      // Remember this as a rule for future imports.
      const next = [...rules.filter((r) => r.merchant !== target.merchant), { merchant: target.merchant, categoryId }];
      setRules(next);
      await db.set("rules", next);
    }
    return changed.length;
  }, [db, transactions, rules]);

  const deleteTransaction = useCallback(async (id: string) => {
    await db.deleteTransactions([id]);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, [db]);

  const saveSettings = useCallback(async (next: TripSettings) => {
    await db.set("settings", next);
    setSettings(next);
    setHasSettings(true);
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
  }, [db, transactions, rules]);

  const saveChecklist = useCallback(async (items: ChecklistItem[]) => {
    setChecklist(items);
    await db.set("checklist", items);
  }, [db]);

  const saveMapping = useCallback(async (mapping: ColumnMapping) => {
    const next = [...mappings.filter((m) => m.signature !== mapping.signature), mapping];
    setMappings(next);
    await db.set("mappings", next);
  }, [db, mappings]);

  const markBackedUp = useCallback(async () => {
    const next = { ...settings, lastBackupAt: new Date().toISOString() };
    setSettings(next);
    await db.set("settings", next);
  }, [db, settings]);

  const exportData = useCallback(
    (): TripData => ({ transactions, settings: hasSettings ? settings : null, checklist, rules, mappings }),
    [transactions, settings, hasSettings, checklist, rules, mappings],
  );

  const replaceAll = useCallback(async (data: TripData) => {
    await db.clear();
    await db.putTransactions(data.transactions);
    if (data.settings) await db.set("settings", data.settings);
    if (data.checklist) await db.set("checklist", data.checklist);
    await db.set("rules", data.rules);
    await db.set("mappings", data.mappings);
    apply(data);
  }, [db, apply]);

  const clearAll = useCallback(async () => {
    await db.clear();
    apply({ transactions: [], settings: null, checklist: null, rules: [], mappings: [] });
  }, [db, apply]);

  const value: TripContextValue = {
    ready, isDemo, transactions, settings, hasSettings, checklist, rules, mappings,
    importRows, setCategory, deleteTransaction, saveSettings, saveChecklist, saveMapping, markBackedUp,
    exportData, replaceAll, clearAll,
  };
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip must be used inside TripProvider");
  return value;
}
