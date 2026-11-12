import { describe, expect, it } from "vitest";
import { BUILT_IN_RATES, formatLocal, fromPence, toPence } from "./fx";
import { budgetStatuses, countableTransactions, followOrder, moveItem, routeWarnings, stopForDate, stopStats } from "./route";
import type { Transaction, TripSettings, TripStop } from "./types";

const tx = (date: string, amount: number, categoryId = "eating_out"): Transaction => ({
  id: `${date}-${amount}-${categoryId}`, date, description: "X", merchant: "X", amount, categoryId,
  categorySource: "keyword", isForeign: false, source: "csv", importId: "i", dedupeKey: `${date}${amount}`,
});

const stop = (country: string, startDate: string, endDate: string, dailyBudget = 3000): TripStop => ({
  id: country, country, flag: "", currency: "THB", startDate, endDate, dailyBudget,
});

describe("exchange rates", () => {
  const fx = { ...BUILT_IN_RATES, rates: { GBP: 1, THB: 40, VND: 32000 } };
  it("converts local money to pence and back", () => {
    expect(toPence(250, "THB", fx)).toBe(625); // ฿250 = £6.25
    expect(toPence(64000, "VND", fx)).toBe(200);
    expect(fromPence(1000, "THB", fx)).toBe(400);
  });
  it("falls back to built-in rates for currencies missing from a download", () => {
    expect(toPence(BUILT_IN_RATES.rates.NZD, "NZD", fx)).toBe(100);
  });
  it("formats amounts in their own currency", () => {
    expect(formatLocal(250, "THB")).toContain("250");
    expect(formatLocal(120000, "VND")).toContain("120,000");
  });
});

describe("route", () => {
  const thailand = stop("Thailand", "2027-02-01", "2027-02-10", 3000); // 10 days at £30
  it("finds the stop for a date", () => {
    expect(stopForDate("2027-02-05", [thailand])?.country).toBe("Thailand");
    expect(stopForDate("2027-02-11", [thailand])).toBeUndefined();
  });

  it("works out actual vs target daily spend, and what to aim for", () => {
    const txs = [tx("2027-02-01", -4000), tx("2027-02-02", -4000), tx("2027-02-03", -1000), tx("2027-01-31", -9999)];
    const s = stopStats(thailand, txs, "2027-02-03");
    expect(s.days).toBe(10);
    expect(s.planned).toBe(30000);
    expect(s.spent).toBe(9000); // the day before isn't counted
    expect(s.daysElapsed).toBe(3);
    expect(s.actualDaily).toBe(3000);
    expect(s.status).toBe("good");
    expect(s.daysLeft).toBe(7);
    expect(s.aimDaily).toBe(3000); // (30000 - 9000) / 7
  });

  it("marks a stop amber when slightly over and red when well over", () => {
    expect(stopStats(thailand, [tx("2027-02-01", -3200)], "2027-02-01").status).toBe("close");
    expect(stopStats(thailand, [tx("2027-02-01", -4000)], "2027-02-01").status).toBe("over");
    expect(stopStats(thailand, [], "2027-01-15").status).toBe("upcoming");
  });

  it("warns about overlaps, gaps and order", () => {
    const vietnam = stop("Vietnam", "2027-02-10", "2027-02-20");
    expect(routeWarnings([thailand, vietnam])).toEqual(["Thailand and Vietnam overlap."]);
    const peru = stop("Peru", "2027-02-15", "2027-02-20");
    expect(routeWarnings([thailand, peru])).toEqual(["4 day gap between Thailand and Peru."]);
    expect(routeWarnings([peru, thailand])).toEqual(["Thailand is after Peru in your route, but its dates are earlier."]);
  });

  it("moves dates to follow a new order, keeping each country's length", () => {
    const vietnam = stop("Vietnam", "2027-02-11", "2027-02-15"); // 5 days
    const moved = followOrder([vietnam, thailand]); // Thailand is 10 days
    expect(moved.map((s) => [s.country, s.startDate, s.endDate])).toEqual([
      ["Vietnam", "2027-02-01", "2027-02-05"],
      ["Thailand", "2027-02-06", "2027-02-15"],
    ]);
    expect(routeWarnings(moved)).toEqual([]);
  });

  it("moves items for drag-to-reorder", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});

describe("budgets and cash", () => {
  it("compares category spending with monthly budgets", () => {
    const txs = [tx("2027-02-01", -8500), tx("2027-02-02", -1000, "groceries"), tx("2027-01-30", -5000)];
    const [eating, groceries] = budgetStatuses(
      [{ categoryId: "eating_out", monthly: 10000 }, { categoryId: "groceries", monthly: 500 }], txs, "2027-02");
    expect(eating).toMatchObject({ spent: 8500, status: "close" });
    expect(groceries).toMatchObject({ spent: 1000, status: "over" });
  });

  it("doesn't count ATM withdrawals twice once you log cash spending", () => {
    const settings = { trackCashSpending: true } as TripSettings;
    const txs = [tx("2027-02-01", -10000, "cash"), tx("2027-02-01", -500, "eating_out")];
    expect(countableTransactions(txs, settings).map((t) => t.categoryId)).toEqual(["eating_out"]);
    expect(countableTransactions(txs, { ...settings, trackCashSpending: false })).toHaveLength(2);
  });
});
