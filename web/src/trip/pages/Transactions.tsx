import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCategory } from "../categories";
import { CategoryBadge, CategoryIcon, CategoryPicker } from "../components/CategoryPicker";
import { formatLocal } from "../fx";
import { formatDate, formatMoney } from "../money";
import { useTrip } from "../store";
import type { Transaction } from "../types";

// Every transaction, newest first, with search and filters.
// Tap one to change its category; you'll be asked whether to do the same for
// every transaction from that merchant (and future imports).

const QUICK_FILTERS = [
  { key: "", label: "All" },
  { key: "check", label: "⚠️ Check" },
  { key: "fees", label: "💱 Fees" },
  { key: "foreign", label: "🌍 Foreign" },
  { key: "in", label: "💰 Money in" },
];

export default function Transactions() {
  const { transactions, setCategory, settings } = useTrip();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirm, setConfirm] = useState<{ tx: Transaction; categoryId: string; others: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [limit, setLimit] = useState(200);

  const filter = params.get("filter") ?? "";
  const category = params.get("category") ?? "";
  const month = params.get("month") ?? "";
  const day = params.get("date") ?? "";
  const search = params.get("search") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const list = useMemo(() => {
    const q = search.trim().toUpperCase();
    return transactions
      .filter((t) => {
        if (filter === "check" && t.categorySource !== "unsure") return false;
        if (filter === "fees" && t.categoryId !== "fees") return false;
        if (filter === "foreign" && !t.isForeign) return false;
        if (filter === "in" && t.amount <= 0) return false;
        if (category && t.categoryId !== category) return false;
        if (month && !t.date.startsWith(month)) return false;
        if (day && t.date !== day) return false;
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        if (q && !t.description.toUpperCase().includes(q) && !t.merchant.includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.amount - b.amount);
  }, [transactions, filter, category, month, day, search, from, to]);

  const total = list.reduce((s, t) => s + t.amount, 0);
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of list.slice(0, limit)) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()];
  }, [list, limit]);

  async function pick(categoryId: string) {
    if (!editing) return;
    const tx = editing;
    setEditing(null);
    const others = transactions.filter((t) => t.id !== tx.id && t.merchant === tx.merchant).length;
    if (others > 0) setConfirm({ tx, categoryId, others });
    else await apply(tx, categoryId, false);
  }

  async function apply(tx: Transaction, categoryId: string, all: boolean) {
    setConfirm(null);
    const n = await setCategory(tx.id, categoryId, all);
    setToast(all ? `Updated ${n} ${tx.merchant} transactions. Future ones will be too.` : "Category updated");
    setTimeout(() => setToast(null), 2500);
  }

  if (transactions.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-4xl">📋</p>
        <p className="mt-2 font-bold">No transactions yet</p>
        <p className="text-muted">Import a bank statement to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <input
        className="input"
        type="search"
        placeholder="🔍 Search merchants or descriptions"
        value={search}
        onChange={(e) => setParam("search", e.target.value)}
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setParam("filter", f.key)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${filter === f.key ? "bg-brand text-white" : "bg-white ring-1 ring-black/5"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(category || month || day || from) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Showing:</span>
          {category && <button onClick={() => setParam("category", "")}><CategoryBadge id={category} small /> ✕</button>}
          {month && <button onClick={() => setParam("month", "")} className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-black/5">{month} ✕</button>}
          {day && <button onClick={() => setParam("date", "")} className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-black/5">{formatDate(day, "long")} ✕</button>}
          {from && (
            <button onClick={() => { const next = new URLSearchParams(params); next.delete("from"); next.delete("to"); setParams(next, { replace: true }); }}
              className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-black/5">
              {formatDate(from)} – {formatDate(to || from, "long")} ✕
            </button>
          )}
        </div>
      )}

      <p className="text-sm text-muted">
        {list.length} transaction{list.length === 1 ? "" : "s"} · total {formatMoney(total)}
      </p>

      {groups.map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-2 text-sm font-bold text-muted">{formatDate(date, "long")}</h2>
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
            {items.map((t) => (
              <button
                key={t.id}
                onClick={() => setEditing(t)}
                className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left last:border-0 active:bg-cream"
              >
                <CategoryIcon id={t.categoryId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.merchant}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {getCategory(t.categoryId).name}
                    {t.categorySource === "unsure" && <span className="rounded-full bg-sun/30 px-2 font-bold text-ink">⚠️ Check</span>}
                    {t.isForeign && <span>🌍</span>}
                    {t.source === "manual" && <span className="rounded-full bg-good/15 px-2 font-bold text-good">💵 Cash</span>}
                    {settings.trackCashSpending && t.categoryId === "cash" && <span>(not counted: you log cash spending)</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block font-bold ${t.amount > 0 ? "text-good" : ""}`}>
                    {t.amount > 0 ? "+" : ""}{formatMoney(t.amount)}
                  </span>
                  {t.localAmount !== undefined && t.currency && t.currency !== "GBP" && (
                    <span className="block text-xs text-muted">{formatLocal(-t.localAmount, t.currency)}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {list.length > limit && (
        <button className="btn-soft" onClick={() => setLimit((l) => l + 200)}>Show more</button>
      )}

      {editing && (
        <CategoryPicker
          title={`${editing.merchant} · ${formatMoney(editing.amount)}`}
          current={editing.categoryId}
          onPick={pick}
          onClose={() => setEditing(null)}
        />
      )}

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-10 md:rounded-3xl md:pb-6" role="dialog">
            <p className="text-lg font-bold">Apply to all {confirm.tx.merchant} transactions?</p>
            <p className="mt-1 text-muted">
              There {confirm.others === 1 ? "is 1 other" : `are ${confirm.others} others`}. I'll also remember this for future imports.
            </p>
            <div className="mt-4"><CategoryBadge id={confirm.categoryId} /></div>
            <div className="mt-5 grid gap-2">
              <button className="btn" onClick={() => apply(confirm.tx, confirm.categoryId, true)}>Yes, all of them</button>
              <button className="btn-soft" onClick={() => apply(confirm.tx, confirm.categoryId, false)}>Just this one</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-white shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
