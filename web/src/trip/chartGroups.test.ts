import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "./categories";
import { CHART_GROUPS, GROUP_COLOURS, categoriesIn, groupOf, mix, totalsByGroup } from "./chartGroups";

describe("chart groups", () => {
  it("puts every spending category in exactly one group", () => {
    for (const c of DEFAULT_CATEGORIES.filter((c) => c.kind === "spend" && c.id !== "uncategorised")) {
      const groups = CHART_GROUPS.filter((g) => g.categories.includes(c.id));
      expect(groups.map((g) => g.id), c.id).toHaveLength(1);
    }
    expect(groupOf("uncategorised")).toBe("other");
    expect(CHART_GROUPS.length).toBeLessThanOrEqual(8);
  });

  it("adds category totals into group totals, biggest first", () => {
    const totals = totalsByGroup([
      { categoryId: "eating_out", total: 500 }, { categoryId: "groceries", total: 300 },
      { categoryId: "flights", total: 1000 }, { categoryId: "uncategorised", total: 50 },
    ]);
    expect(totals).toEqual([
      { groupId: "transport", total: 1000 }, { groupId: "food", total: 800 }, { groupId: "other", total: 50 },
    ]);
  });

  it("finds the categories in a group", () => {
    const inFood = categoriesIn("food");
    expect(inFood("coffee")).toBe(true);
    expect(inFood("flights")).toBe(false);
  });

  it("gives every group its own colour", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    for (const g of CHART_GROUPS) expect(GROUP_COLOURS[g.id], g.id).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(Object.values(GROUP_COLOURS)).size).toBe(CHART_GROUPS.length);
  });
});
