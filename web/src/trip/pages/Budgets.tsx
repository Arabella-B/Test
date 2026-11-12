import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Sheet from "../../components/Sheet";
import { DEFAULT_CATEGORIES, getCategory } from "../categories";
import { CategoryIcon } from "../components/CategoryPicker";
import { formatMoney, today } from "../money";
import { budgetStatuses, countableTransactions, spendOf } from "../route";
import { useTrip } from "../store";
import type { CategoryBudget } from "../types";

// Monthly budgets for each category: green under, amber from 80%, red over.

const BAR = { good: "bg-good", close: "bg-warn", over: "bg-bad" };

function shiftMonth(month: string, by: number): string {
  const d = new Date(`${month}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

export default function Budgets() {
  const { budgets, saveBudgets, transactions, settings } = useTrip();
  const navigate = useNavigate();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [editing, setEditing] = useState<CategoryBudget | "new" | null>(null);

  const countable = useMemo(() => countableTransactions(transactions, settings), [transactions, settings]);
  const statuses = useMemo(() => budgetStatuses(budgets, countable, month), [budgets, countable, month]);
  const monthLabel = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const isThisMonth = month === today().slice(0, 7);
  const lastDay = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const daysLeft = isThisMonth ? lastDay - +today().slice(8, 10) : 0;

  const totalBudget = budgets.reduce((s, b) => s + b.monthly, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
  const unbudgeted = countable
    .filter((t) => t.date.startsWith(month) && !budgets.some((b) => b.categoryId === t.categoryId))
    .reduce((s, t) => s + spendOf(t), 0);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center justify-between rounded-3xl bg-white p-2 ring-1 ring-black/5">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-cream" aria-label="Previous month">‹</button>
        <div className="text-center">
          <p className="font-extrabold">{monthLabel}</p>
          {isThisMonth && <p className="text-xs text-muted">{daysLeft} day{daysLeft === 1 ? "" : "s"} left</p>}
        </div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-cream" aria-label="Next month">›</button>
      </div>

      {budgets.length > 0 && (
        <div className="card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-muted">Budgeted categories</p>
            <p className="text-2xl font-extrabold">{formatMoney(totalSpent, true)} <span className="text-base font-semibold text-muted">of {formatMoney(totalBudget, true)}</span></p>
          </div>
          {unbudgeted > 0 && <p className="text-right text-xs text-muted">+ {formatMoney(unbudgeted, true)}<br />in other categories</p>}
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="card text-center">
          <p className="text-4xl">🎯</p>
          <p className="mt-2 font-bold">No budgets yet</p>
          <p className="text-sm text-muted">Set a monthly limit for categories you want to keep an eye on, like eating out or going out.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {statuses.map(({ budget, spent, share, status }) => {
            const cat = getCategory(budget.categoryId);
            const left = budget.monthly - spent;
            return (
              <div key={budget.categoryId} className="rounded-3xl bg-white p-4 ring-1 ring-black/5">
                <div className="flex items-center gap-3">
                  <CategoryIcon id={budget.categoryId} size={40} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/trip/transactions?category=${budget.categoryId}&month=${month}`)}>
                    <span className="block truncate font-bold">{cat.name}</span>
                    <span className="block text-sm">
                      <b>{formatMoney(spent, true)}</b> <span className="text-muted">of {formatMoney(budget.monthly, true)}</span>
                    </span>
                  </button>
                  <button onClick={() => setEditing(budget)} className="rounded-full bg-cream px-3 py-2 text-sm font-semibold">Edit</button>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/5" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full rounded-full ${BAR[status]}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
                </div>
                <p className={`mt-1 text-xs font-semibold ${status === "over" ? "text-bad" : status === "close" ? "text-warn" : "text-good"}`}>
                  {left >= 0 ? `${formatMoney(left, true)} left` : `${formatMoney(-left, true)} over`}
                  {isThisMonth && left > 0 && daysLeft > 0 && <span className="font-normal text-muted"> · about {formatMoney(Math.floor(left / daysLeft), true)}/day</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn" onClick={() => setEditing("new")}>+ Set a budget</button>

      {editing && (
        <BudgetSheet
          budget={editing === "new" ? null : editing}
          taken={budgets.map((b) => b.categoryId)}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            void saveBudgets([...budgets.filter((x) => x.categoryId !== b.categoryId), b]);
            setEditing(null);
          }}
          onDelete={(id) => {
            void saveBudgets(budgets.filter((x) => x.categoryId !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BudgetSheet({ budget, taken, onClose, onSave, onDelete }: {
  budget: CategoryBudget | null; taken: string[]; onClose: () => void; onSave: (b: CategoryBudget) => void; onDelete: (id: string) => void;
}) {
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? "");
  const [amount, setAmount] = useState(budget ? String(budget.monthly / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const choices = DEFAULT_CATEGORIES.filter((c) => c.kind === "spend" && c.id !== "uncategorised" && (c.id === budget?.categoryId || !taken.includes(c.id)));

  function submit(e: FormEvent) {
    e.preventDefault();
    const pence = Math.round((parseFloat(amount) || 0) * 100);
    if (!categoryId) return setError("Choose a category.");
    if (pence <= 0) return setError("Add a monthly amount in pounds.");
    onSave({ categoryId, monthly: pence });
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4">
        <h2 className="text-xl font-extrabold">{budget ? `${getCategory(budget.categoryId).name} budget` : "Set a monthly budget"}</h2>
        {!budget && (
          <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
            {choices.map((c) => (
              <button type="button" key={c.id} onClick={() => setCategoryId(c.id)}
                className={`flex min-h-12 items-center gap-2 rounded-2xl border-2 px-3 text-left text-sm font-semibold ${categoryId === c.id ? "border-brand" : "border-transparent"}`}
                style={{ backgroundColor: c.colour + "1F" }}>
                <span className="text-lg">{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
        )}
        <label className="label">Monthly budget (£)
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 200" />
        </label>
        {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
        <button className="btn">Save</button>
        {budget && (
          <button type="button" onClick={() => onDelete(budget.categoryId)} className="min-h-12 rounded-2xl font-semibold text-bad ring-1 ring-bad/30">
            Remove budget
          </button>
        )}
      </form>
    </Sheet>
  );
}
