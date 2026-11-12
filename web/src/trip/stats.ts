import { DEFAULT_CATEGORIES, getCategory } from "./categories";
import { addDays, daysBetween, today } from "./money";
import { countableTransactions } from "./route";
import type { Transaction, TripSettings } from "./types";

// Calculations for the dashboard. Everything works in pence.

/** Money that counts as spending: out-going, not a transfer, inside the budget period. */
export function spendingOf(t: Transaction): number {
  const kind = getCategory(t.categoryId).kind;
  return kind === "spend" ? -t.amount : 0; // a refund in a spend category reduces spending
}

export function incomeOf(t: Transaction): number {
  return getCategory(t.categoryId).kind === "income" ? t.amount : 0;
}

export function inBudget(t: Transaction, settings: TripSettings): boolean {
  return !settings.budgetStartDate || t.date >= settings.budgetStartDate;
}

export interface Runway {
  date: string | null; // the day the money runs out at the current rate
  daysLeft: number | null;
  status: "good" | "close" | "over" | "unknown";
  futureFamily: number; // family support still expected before the return date
  dailyToLastUntilReturn: number | null; // what you can spend per day to make it to the return date
}

export interface DashboardStats {
  spent: number;
  income: number;
  moneyLeft: number;
  spentThisMonth: number;
  averageDaily: number;
  runway: Runway;
  fees: number;
  byCategory: { categoryId: string; total: number }[];
  monthly: Record<string, number | string>[]; // { month: "Nov 26", groceries: 12.3, ... } in pounds
  monthlyCategories: string[];
  budgetLine: { date: string; actual?: number; plan: number }[]; // pounds
  topMerchants: { merchant: string; total: number; count: number }[];
  daily: Map<string, number>;
  needsChecking: number;
}

export function computeStats(all: Transaction[], settings: TripSettings, now = today()): DashboardStats {
  // Once you log cash spending by hand, ATM withdrawals are left out so nothing is counted twice.
  const txs = countableTransactions(all, settings).filter((t) => inBudget(t, settings));
  const spent = txs.reduce((s, t) => s + spendingOf(t), 0);
  const income = txs.reduce((s, t) => s + incomeOf(t), 0);
  const moneyLeft = settings.totalBudget - spent + income;

  const month = now.slice(0, 7);
  const spentThisMonth = txs.filter((t) => t.date.startsWith(month)).reduce((s, t) => s + spendingOf(t), 0);

  // Average daily spend over the last 30 days (or since the budget started, if sooner).
  const windowStart = [addDays(now, -29), settings.budgetStartDate].filter(Boolean).sort().pop()!;
  const windowDays = Math.max(1, daysBetween(windowStart, now) + 1);
  const recent = txs.filter((t) => t.date >= windowStart && t.date <= now).reduce((s, t) => s + spendingOf(t), 0);
  const averageDaily = Math.round(recent / windowDays);

  const runway = computeRunway(moneyLeft, averageDaily, settings, now);

  const fees = txs.filter((t) => t.categoryId === "fees").reduce((s, t) => s + spendingOf(t), 0);

  const catTotals = new Map<string, number>();
  for (const t of txs) {
    const s = spendingOf(t);
    if (s) catTotals.set(t.categoryId, (catTotals.get(t.categoryId) ?? 0) + s);
  }
  const byCategory = [...catTotals.entries()]
    .filter(([, total]) => total > 0)
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);

  // Monthly stacked bars (pounds), in category order so colours stay consistent.
  const months = new Map<string, Record<string, number>>();
  for (const t of txs) {
    const s = spendingOf(t);
    if (!s) continue;
    const key = t.date.slice(0, 7);
    const row = months.get(key) ?? {};
    row[t.categoryId] = (row[t.categoryId] ?? 0) + s / 100;
    months.set(key, row);
  }
  const monthlyCategories = DEFAULT_CATEGORIES.filter((c) => byCategory.some((b) => b.categoryId === c.id)).map((c) => c.id);
  const monthly = [...months.keys()].sort().map((key) => ({
    month: new Date(key + "-15T12:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    key,
    ...months.get(key),
  }));

  const budgetLine = computeBudgetLine(txs, settings, now);

  const merchants = new Map<string, { total: number; count: number }>();
  for (const t of txs) {
    const s = spendingOf(t);
    if (s <= 0 || getCategory(t.categoryId).id === "fees") continue;
    const m = merchants.get(t.merchant) ?? { total: 0, count: 0 };
    m.total += s;
    m.count += 1;
    merchants.set(t.merchant, m);
  }
  const topMerchants = [...merchants.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const daily = new Map<string, number>();
  for (const t of txs) {
    const s = spendingOf(t);
    if (s > 0) daily.set(t.date, (daily.get(t.date) ?? 0) + s);
  }

  return {
    spent, income, moneyLeft, spentThisMonth, averageDaily, runway, fees, byCategory, monthly, monthlyCategories,
    budgetLine, topMerchants, daily, needsChecking: all.filter((t) => t.categorySource === "unsure").length,
  };
}

/** Family support still to come: the monthly amount for each remaining month until you're home. */
export function futureFamilySupport(settings: TripSettings, now: string): number {
  if (!settings.familySupportMonthly || !settings.returnDate || settings.returnDate <= now) return 0;
  const months = daysBetween(now, settings.returnDate) / 30.44;
  return Math.round(settings.familySupportMonthly * months);
}

export function computeRunway(moneyLeft: number, averageDaily: number, settings: TripSettings, now: string): Runway {
  const futureFamily = futureFamilySupport(settings, now);
  const available = moneyLeft + futureFamily;
  const daysToReturn = settings.returnDate ? daysBetween(now, settings.returnDate) : null;
  const dailyToLastUntilReturn = daysToReturn && daysToReturn > 0 ? Math.max(0, Math.floor(available / daysToReturn)) : null;

  if (averageDaily <= 0) return { date: null, daysLeft: null, status: "unknown", futureFamily, dailyToLastUntilReturn };
  const daysLeft = Math.max(0, Math.floor(available / averageDaily));
  const date = addDays(now, daysLeft);
  let status: Runway["status"] = "unknown";
  if (settings.returnDate) {
    const margin = daysBetween(settings.returnDate, date);
    status = margin < 0 ? "over" : margin < 14 ? "close" : "good";
  }
  return { date, daysLeft, status, futureFamily, dailyToLastUntilReturn };
}

/** Cumulative spending against a straight-line plan from the budget start to your return date. */
function computeBudgetLine(txs: Transaction[], settings: TripSettings, now: string): DashboardStats["budgetLine"] {
  const start = settings.budgetStartDate || txs.map((t) => t.date).sort()[0];
  if (!start) return [];
  const end = settings.returnDate && settings.returnDate > now ? settings.returnDate : now;
  const totalDays = Math.max(1, daysBetween(start, end));
  const tripMonths = settings.returnDate ? Math.max(0, daysBetween(start, settings.returnDate) / 30.44) : 0;
  const planTotal = settings.totalBudget + Math.round(settings.familySupportMonthly * tripMonths);

  const perDay = new Map<string, number>();
  for (const t of txs) perDay.set(t.date, (perDay.get(t.date) ?? 0) + spendingOf(t));

  const points: DashboardStats["budgetLine"] = [];
  const step = Math.max(1, Math.ceil(totalDays / 120)); // keep the chart light
  let running = 0;
  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(start, i);
    running += perDay.get(date) ?? 0;
    if (i % step === 0 || i === totalDays || date === now) {
      points.push({
        date,
        plan: Math.round((planTotal * i) / totalDays) / 100,
        actual: date <= now ? running / 100 : undefined,
      });
    }
  }
  return points;
}
