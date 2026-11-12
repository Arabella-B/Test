import { useEffect, useMemo, useState } from "react";
import Stamp from "../../components/Stamp";
import { celebrate } from "../../lib/celebrate";
import { formatDate, today } from "../money";
import { budgetStatuses, countableTransactions, stopForDate, stopStats } from "../route";
import { useTrip } from "../store";
import type { TripStop } from "../types";
import { getCategory } from "../categories";

// Watches My Trip for milestones and celebrates them:
// - a NEW COUNTRY on your route begins → its passport stamp thumps down, with confetti;
// - a country or category goes from over budget BACK ON BUDGET → confetti.
// (First import and finishing the checklist are celebrated on their own pages.)

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export default function Celebrations() {
  const { scope, stops, transactions, settings, budgets, ready } = useTrip();
  const [arrived, setArrived] = useState<TripStop | null>(null);

  // New country stamps
  useEffect(() => {
    if (!ready) return;
    const key = `wayfund-stamped-${scope}`;
    const stamped = new Set(readJson<string[]>(key, []));
    const now = today();
    const started = stops.filter((s) => s.startDate <= now && !stamped.has(s.id));
    if (started.length === 0) return;
    started.forEach((s) => stamped.add(s.id));
    writeJson(key, [...stamped]);
    const newest = [...started].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    // Only make a fuss about the country you're in now (not ones from long ago).
    if (newest.endDate >= now) {
      setArrived(newest);
      setTimeout(() => celebrate(), 450);
    }
  }, [ready, scope, stops]);

  // Back on budget
  const statuses = useMemo(() => {
    const txs = countableTransactions(transactions, settings);
    const now = today();
    const out: Record<string, { name: string; status: string }> = {};
    const here = stopForDate(now, stops);
    if (here) out[`stop-${here.id}`] = { name: here.country, status: stopStats(here, txs, now).status };
    for (const b of budgetStatuses(budgets, txs, now.slice(0, 7))) {
      out[`budget-${b.budget.categoryId}`] = { name: getCategory(b.budget.categoryId).name, status: b.status };
    }
    return out;
  }, [transactions, settings, stops, budgets]);

  useEffect(() => {
    if (!ready) return;
    const key = `wayfund-statuses-${scope}`;
    const before = readJson<Record<string, string> | null>(key, null);
    const nowStatuses = Object.fromEntries(Object.entries(statuses).map(([k, v]) => [k, v.status]));
    writeJson(key, nowStatuses);
    if (!before) return; // first time: just remember
    const recovered = Object.entries(statuses).find(([k, v]) => v.status === "good" && (before[k] === "over" || before[k] === "close"));
    if (recovered) celebrate(`🎉 Back on budget: ${recovered[1].name}`);
  }, [ready, scope, statuses]);

  if (!arrived) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6 backdrop-blur-sm" onClick={() => setArrived(null)} role="dialog" aria-label={`Welcome to ${arrived.country}`}>
      <div className="grid place-items-center gap-5 w-full max-w-sm rounded-[2rem] bg-cream px-6 py-10 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Stamp size="lg" thump title={arrived.country} subtitle={formatDate(arrived.startDate, "long")} icon={arrived.flag} index={arrived.country.length} />
        <div>
          <p className="font-display text-3xl font-extrabold">Welcome to {arrived.country}!</p>
          <p className="mt-1 text-muted">A new stamp for your passport. Have the best time {arrived.flag}</p>
        </div>
        <button className="btn" onClick={() => setArrived(null)}>Let's go</button>
      </div>
    </div>
  );
}
