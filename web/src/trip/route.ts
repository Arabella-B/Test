import { getCategory } from "./categories";
import { addDays, daysBetween, today } from "./money";
import type { CategoryBudget, Transaction, TripSettings, TripStop } from "./types";

// Your route (the countries you'll visit) and your budgets.

export type Status = "good" | "close" | "over";

/**
 * Transactions counted as spending. When you log cash spending by hand,
 * ATM withdrawals are left out so the same money isn't counted twice.
 */
export function countableTransactions(txs: Transaction[], settings: TripSettings): Transaction[] {
  return settings.trackCashSpending ? txs.filter((t) => t.categoryId !== "cash") : txs;
}

/** Pence spent (refunds reduce it); transfers and money in don't count. */
export function spendOf(t: Transaction): number {
  return getCategory(t.categoryId).kind === "spend" ? -t.amount : 0;
}

/** Nights/days in a stop, counting both the first and last day. */
export function stopDays(stop: TripStop): number {
  return Math.max(1, daysBetween(stop.startDate, stop.endDate) + 1);
}

/** Which stop you're in on a given date (the first match wins if dates overlap). */
export function stopForDate(date: string, stops: TripStop[]): TripStop | undefined {
  return stops.find((s) => date >= s.startDate && date <= s.endDate);
}

export interface StopStats {
  stop: TripStop;
  days: number;
  planned: number; // pence for the whole stop
  daysElapsed: number; // 0 before it starts
  spent: number; // pence so far
  actualDaily: number | null; // pence per day so far, null before it starts
  remaining: number; // planned - spent
  daysLeft: number;
  aimDaily: number | null; // to finish on budget
  status: Status | "upcoming";
}

/** How a stop is going: actual daily spend vs the target. Amber up to 10% over. */
export function stopStats(stop: TripStop, txs: Transaction[], now = today()): StopStats {
  const days = stopDays(stop);
  const planned = stop.dailyBudget * days;
  const spent = txs
    .filter((t) => t.date >= stop.startDate && t.date <= stop.endDate)
    .reduce((s, t) => s + spendOf(t), 0);
  const lastCounted = now < stop.endDate ? now : stop.endDate;
  const daysElapsed = now < stop.startDate ? 0 : daysBetween(stop.startDate, lastCounted) + 1;
  const daysLeft = Math.max(0, days - daysElapsed);
  const actualDaily = daysElapsed > 0 ? Math.round(spent / daysElapsed) : null;
  const remaining = planned - spent;
  const aimDaily = daysLeft > 0 ? Math.max(0, Math.floor(remaining / daysLeft)) : null;
  let status: StopStats["status"] = "upcoming";
  if (actualDaily !== null) {
    status = actualDaily <= stop.dailyBudget ? "good" : actualDaily <= stop.dailyBudget * 1.1 ? "close" : "over";
  }
  return { stop, days, planned, daysElapsed, spent, actualDaily, remaining, daysLeft, aimDaily, status };
}

/** Problems with the dates: overlaps and gaps between stops, in route order. */
export function routeWarnings(stops: TripStop[]): string[] {
  const warnings: string[] = [];
  stops.forEach((s, i) => {
    if (s.endDate < s.startDate) warnings.push(`${s.country}: the last day is before the first day.`);
    const next = stops[i + 1];
    if (!next) return;
    if (next.startDate < s.startDate) {
      // The order doesn't match the dates; that explains any overlap, so say only this.
      warnings.push(`${next.country} is after ${s.country} in your route, but its dates are earlier.`);
    } else if (next.startDate <= s.endDate) {
      warnings.push(`${s.country} and ${next.country} overlap.`);
    } else if (next.startDate > addDays(s.endDate, 1)) {
      warnings.push(`${daysBetween(s.endDate, next.startDate) - 1} day gap between ${s.country} and ${next.country}.`);
    }
  });
  return warnings;
}

/**
 * Give stops new dates that follow the route order, back to back, keeping how
 * long each one is. Starts from the earliest date in the route.
 */
export function followOrder(stops: TripStop[]): TripStop[] {
  if (stops.length === 0) return stops;
  let start = stops.map((s) => s.startDate).sort()[0];
  return stops.map((s) => {
    const length = stopDays(s);
    const moved = { ...s, startDate: start, endDate: addDays(start, length - 1) };
    start = addDays(moved.endDate, 1);
    return moved;
  });
}

/** Move an item in a list from one position to another (used for drag to reorder). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

export interface BudgetStatus {
  budget: CategoryBudget;
  spent: number;
  share: number; // 0..∞ (1 = exactly on budget)
  status: Status;
}

/** Spending against each category budget for a month ("2026-11"). Amber from 80%. */
export function budgetStatuses(budgets: CategoryBudget[], txs: Transaction[], month: string): BudgetStatus[] {
  return budgets.map((budget) => {
    const spent = txs
      .filter((t) => t.categoryId === budget.categoryId && t.date.startsWith(month))
      .reduce((s, t) => s + spendOf(t), 0);
    const share = budget.monthly > 0 ? spent / budget.monthly : 0;
    return { budget, spent, share, status: share > 1 ? "over" : share >= 0.8 ? "close" : "good" };
  });
}

/** Money still needed for the rest of the route: unspent budget of current and future stops. */
export function remainingRoutePlan(stops: TripStop[], txs: Transaction[], now = today()): number {
  return stops.reduce((sum, s) => {
    if (s.endDate < now) return sum;
    const st = stopStats(s, txs, now);
    return sum + Math.max(0, st.daysElapsed > 0 ? st.remaining : st.planned);
  }, 0);
}
