import { getCategory } from "./categories";

// For charts, the 26 spending categories are combined into 8 easy-to-read groups,
// coloured from the current theme (so charts match whichever theme you pick).
// Lists and transactions still show the detailed categories.

export interface ChartGroup {
  id: string;
  name: string;
  emoji: string;
  categories: string[];
}

export const CHART_GROUPS: ChartGroup[] = [
  { id: "food", name: "Food and drink", emoji: "🍜", categories: ["groceries", "eating_out", "coffee", "going_out"] },
  { id: "transport", name: "Getting around", emoji: "🚌", categories: ["local_transport", "long_distance", "flights"] },
  { id: "stay", name: "Places to stay", emoji: "🏨", categories: ["accommodation", "laundry"] },
  { id: "fun", name: "Fun and shopping", emoji: "🎟️", categories: ["activities", "shopping", "gifts"] },
  { id: "admin", name: "Essentials and admin", emoji: "📋", categories: ["phone", "subscriptions", "health", "insurance", "travel_health", "visas", "gear"] },
  { id: "cash", name: "Cash", emoji: "💵", categories: ["cash"] },
  { id: "fees", name: "Bank fees", emoji: "💱", categories: ["fees"] },
  { id: "other", name: "Other", emoji: "❓", categories: [] }, // anything else, e.g. uncategorised
];

const byCategory = new Map(CHART_GROUPS.flatMap((g) => g.categories.map((c) => [c, g.id] as const)));

export function groupOf(categoryId: string): string {
  return byCategory.get(categoryId) ?? "other";
}

export function getGroup(id: string): ChartGroup {
  return CHART_GROUPS.find((g) => g.id === id) ?? CHART_GROUPS[CHART_GROUPS.length - 1];
}

/** Categories in a group (for "show me these transactions"). "other" means anything not in a group. */
export function categoriesIn(groupId: string): (categoryId: string) => boolean {
  return (categoryId) => groupOf(categoryId) === groupId && getCategory(categoryId).kind === "spend";
}

/** Add up per-category totals into per-group totals, biggest first. */
export function totalsByGroup(rows: { categoryId: string; total: number }[]): { groupId: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(groupOf(r.categoryId), (totals.get(groupOf(r.categoryId)) ?? 0) + r.total);
  return [...totals.entries()].map(([groupId, total]) => ({ groupId, total })).filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
}

// ---- Colours from the theme ----

function parse(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two hex colours. amount 0 = all a, 1 = all b. */
export function mix(a: string, b: string, amount: number): string {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return a;
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * One soft pastel per group. They're clearly different from each other, sit well with
 * every theme (light and dark), and a group keeps its colour whichever theme you pick.
 */
export const GROUP_COLOURS: Record<string, string> = {
  food: "#f7c37a", // apricot
  transport: "#8fbdf2", // sky blue
  stay: "#86d6bf", // mint
  fun: "#f2a2c0", // pink
  admin: "#b6a3ef", // lavender
  cash: "#a9d39b", // sage
  fees: "#ee8a82", // soft red
  other: "#c8c2b8", // warm grey
};
