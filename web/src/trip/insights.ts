import { getCategory } from "./categories";
import { addDays, daysBetween, formatDate, formatMoney, today } from "./money";
import { computeStats, spendingOf } from "./stats";
import { budgetStatuses, countableTransactions, stopForDate, stopStats } from "./route";
import type { CategoryBudget, Transaction, TripSettings, TripStop } from "./types";

// Friendly, plain-English tips worked out from your own transactions.
// This runs on your device: nothing is sent anywhere.

export interface Insight {
  id: string;
  emoji: string;
  tone: "good" | "warn" | "info";
  title: string;
  text: string;
  priority: number; // higher shows first
  link?: string; // where tapping the tip goes
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function computeInsights(
  allTxs: Transaction[],
  settings: TripSettings,
  extras: { stops?: TripStop[]; budgets?: CategoryBudget[]; now?: string } = {},
): Insight[] {
  const now = extras.now ?? today();
  const out: Insight[] = [];
  const stats = computeStats(allTxs, settings, now);
  const txs = countableTransactions(allTxs, settings);
  const month = now.slice(0, 7);
  const thisMonth = txs.filter((t) => t.date.startsWith(month));

  // 0a. The country you're in now: on track for its budget?
  const here = stopForDate(now, extras.stops ?? []);
  if (here) {
    const st = stopStats(here, txs, now);
    if (st.status === "over" || st.status === "close") {
      const over = st.spent - here.dailyBudget * st.daysElapsed;
      out.push({
        id: "country",
        emoji: here.flag || "🗺️",
        tone: "warn",
        title: `Over your ${here.country} budget`,
        text: `You're ${formatMoney(over, true)} over your ${here.country} budget with ${st.daysLeft} day${st.daysLeft === 1 ? "" : "s"} left.` +
          (st.aimDaily !== null && st.daysLeft > 0 ? ` Aim for ${formatMoney(st.aimDaily, true)}/day to get back on track.` : ""),
        priority: 95,
        link: "/trip/route",
      });
    } else if (st.status === "good" && st.daysElapsed >= 3) {
      out.push({
        id: "country-good",
        emoji: here.flag || "🗺️",
        tone: "good",
        title: `${here.country} is on budget`,
        text: `You're averaging ${formatMoney(st.actualDaily ?? 0, true)}/day against a target of ${formatMoney(here.dailyBudget, true)}. Keep it up!`,
        priority: 25,
        link: "/trip/route",
      });
    }
  }

  // 0b. Category budgets that are nearly used up or over this month
  const lastDay = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const daysLeftInMonth = lastDay - +now.slice(8, 10);
  for (const b of budgetStatuses(extras.budgets ?? [], txs, month)) {
    if (b.status === "good") continue;
    const name = getCategory(b.budget.categoryId).name;
    out.push({
      id: `budget-${b.budget.categoryId}`,
      emoji: getCategory(b.budget.categoryId).emoji,
      tone: "warn",
      title: b.status === "over" ? `${name} budget used up` : `${name} budget nearly used`,
      text: b.status === "over"
        ? `You've spent ${formatMoney(b.spent, true)} on ${name.toLowerCase()} this month, ${formatMoney(b.spent - b.budget.monthly, true)} over your ${formatMoney(b.budget.monthly, true)} budget.`
        : `You've used ${Math.round(b.share * 100)}% of your ${name.toLowerCase()} budget with ${daysLeftInMonth} day${daysLeftInMonth === 1 ? "" : "s"} left this month.`,
      priority: b.status === "over" ? 85 : 65,
      link: "/trip/budgets",
    });
  }

  // 1. Will the money last?
  const { runway } = stats;
  if (runway.date && settings.returnDate && runway.status === "over") {
    const short = daysBetween(runway.date, settings.returnDate);
    out.push({
      id: "runway",
      emoji: "⏳",
      tone: "warn",
      title: "Your money may run out early",
      text: `At this rate your money lasts until ${formatDate(runway.date, "long")}, about ${short} days before you're due home. ` +
        (runway.dailyToLastUntilReturn !== null ? `Aim for around ${formatMoney(runway.dailyToLastUntilReturn, true)} a day to make it.` : ""),
      priority: 100,
    });
  } else if (runway.date && settings.returnDate && runway.status === "good") {
    out.push({
      id: "runway-good",
      emoji: "🎉",
      tone: "good",
      title: "You're on track",
      text: `At your current pace your money lasts until ${formatDate(runway.date, "long")}, after your return date. Nice work!`,
      priority: 20,
    });
  }

  // 2. Bank fees
  if (stats.fees > 0) {
    out.push({
      id: "fees",
      emoji: "💱",
      tone: "warn",
      title: `${formatMoney(stats.fees)} lost to bank fees`,
      text: `You've paid ${formatMoney(stats.fees)} in foreign transaction, cash and ATM fees. A fee-free travel debit card would have saved most of this.`,
      priority: 90,
      link: "/trip/transactions?category=fees",
    });
  }

  // 3. Eating out compared with usual (daily rate this month vs previous months)
  const eatingThisMonth = thisMonth.filter((t) => t.categoryId === "eating_out").reduce((s, t) => s + spendingOf(t), 0);
  const earlier = txs.filter((t) => t.categoryId === "eating_out" && t.date < `${month}-01` && t.date >= addDays(`${month}-01`, -92));
  if (earlier.length >= 5 && eatingThisMonth > 2000) {
    const earlierDays = Math.max(1, daysBetween(earlier.map((t) => t.date).sort()[0], addDays(`${month}-01`, -1)) + 1);
    const usualRate = earlier.reduce((s, t) => s + spendingOf(t), 0) / earlierDays;
    const nowRate = eatingThisMonth / Math.max(1, +now.slice(8, 10));
    if (usualRate > 0 && nowRate > usualRate * 1.4) {
      out.push({
        id: "eating-out",
        emoji: "🍔",
        tone: "info",
        title: "Eating out is up",
        text: `You're spending ${pct(nowRate / usualRate - 1)} more per day on eating out this month than usual.`,
        priority: 60,
        link: "/trip/transactions?category=eating_out",
      });
    }
  }

  // 4. Subscriptions still running
  const recentSubs = txs.filter((t) => t.categoryId === "subscriptions" && t.amount < 0 && t.date >= addDays(now, -45));
  const subs = new Map<string, number>();
  for (const t of recentSubs) subs.set(t.merchant, -t.amount);
  if (subs.size >= 2) {
    const monthly = [...subs.values()].reduce((a, b) => a + b, 0);
    out.push({
      id: "subscriptions",
      emoji: "🔁",
      tone: "info",
      title: `${subs.size} subscriptions still running`,
      text: `You have ${subs.size} subscriptions costing about ${formatMoney(monthly)}/month. Pause any you won't use while travelling?`,
      priority: 70,
      link: "/trip/transactions?category=subscriptions",
    });
  }

  // 5. Small purchases add up
  const small = thisMonth.filter((t) => spendingOf(t) > 0 && spendingOf(t) < 500 && t.categoryId !== "fees");
  const smallTotal = small.reduce((s, t) => s + spendingOf(t), 0);
  if (small.length >= 8 && smallTotal >= 3000) {
    out.push({
      id: "small",
      emoji: "🪙",
      tone: "info",
      title: "Small buys add up",
      text: `${small.length} purchases under £5 added up to ${formatMoney(smallTotal)} this month.`,
      priority: 40,
    });
  }

  // 6. Lots of cash withdrawals
  const withdrawals = allTxs.filter((t) => t.date.startsWith(month) && t.categoryId === "cash" && t.amount < 0);
  if (withdrawals.length >= 4) {
    out.push({
      id: "atm",
      emoji: "🏧",
      tone: "info",
      title: "Lots of cash withdrawals",
      text: `You made ${withdrawals.length} separate cash withdrawals this month. Fewer, larger ones usually mean fewer fixed ATM fees (keep it safe, though).`,
      priority: 55,
      link: "/trip/transactions?category=cash",
    });
  }

  // 7. Possible duplicate charges
  const seen = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.amount >= 0 || getCategory(t.categoryId).kind !== "spend" || t.categoryId === "fees") continue;
    const key = `${t.date}|${t.merchant}|${t.amount}`;
    seen.set(key, [...(seen.get(key) ?? []), t]);
  }
  const dupe = [...seen.values()].filter((g) => g.length >= 2 && -g[0].amount >= 500).sort((a, b) => b[0].date.localeCompare(a[0].date))[0];
  if (dupe) {
    out.push({
      id: "duplicate",
      emoji: "👯",
      tone: "warn",
      title: "Possible double charge",
      text: `${formatMoney(-dupe[0].amount)} at ${dupe[0].merchant} appears ${dupe.length} times on ${formatDate(dupe[0].date)}. Worth checking with your bank if that's wrong.`,
      priority: 80,
      link: `/trip/transactions?search=${encodeURIComponent(dupe[0].merchant)}`,
    });
  }

  // 8. Things to check
  if (stats.needsChecking > 0) {
    out.push({
      id: "check",
      emoji: "🔍",
      tone: "info",
      title: `${stats.needsChecking} to check`,
      text: `${stats.needsChecking} transaction${stats.needsChecking === 1 ? "" : "s"} couldn't be categorised automatically. A quick check keeps your charts accurate.`,
      priority: 50,
      link: "/trip/transactions?filter=check",
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
