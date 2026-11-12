import { describe, expect, it } from "vitest";
import { findCountry } from "./countries";
import { BUILT_IN_CARDS, EUROPE, dailyTotal, getCard, isEurope } from "./countryInfo";

describe("country cards data", () => {
  it("has cards, each with sensible costs and official links", () => {
    expect(BUILT_IN_CARDS.length).toBeGreaterThanOrEqual(20);
    for (const card of BUILT_IN_CARDS) {
      expect(dailyTotal(card, "budget"), card.country).toBeLessThan(dailyTotal(card, "midRange"));
      expect(card.links.some((l) => l.url.startsWith("https://www.gov.uk/foreign-travel-advice/")), card.country).toBe(true);
      expect(card.links.every((l) => l.url.startsWith("https://")), card.country).toBe(true);
      expect(card.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(card.entry.length, card.country).toBeGreaterThan(0);
      // Every card's country can be added to a route (so its currency is known).
      expect(findCountry(card.country), card.country).toBeDefined();
    }
  });

  it("has Europe-wide info for European countries", () => {
    expect(EUROPE).not.toBeNull();
    expect(isEurope("France")).toBe(true);
    expect(isEurope("Thailand")).toBe(false);
  });

  it("applies your edits on top of the built-in card", () => {
    const base = getCard("Thailand")!;
    const edited = getCard("Thailand", { Thailand: { lastChecked: "2027-01-01", costs: { budget: { ...base.costs.budget, food: 99 }, midRange: base.costs.midRange } } })!;
    expect(edited.lastChecked).toBe("2027-01-01");
    expect(edited.costs.budget.food).toBe(99);
    expect(edited.costs.budget.accommodation).toBe(base.costs.budget.accommodation);
    expect(edited.entry).toEqual(base.entry);
  });
});
