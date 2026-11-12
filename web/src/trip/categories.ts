import type { Category } from "./types";

// Every category has its own colour and emoji, used the same way everywhere
// (charts, lists and budgets). Colours are picked to be easy to tell apart
// and readable with white or dark text.
export const DEFAULT_CATEGORIES: Category[] = [
  // Everyday
  { id: "groceries", name: "Groceries", emoji: "🛒", colour: "#22C55E", kind: "spend", group: "Everyday" },
  { id: "eating_out", name: "Eating out", emoji: "🍔", colour: "#F97316", kind: "spend", group: "Everyday" },
  { id: "coffee", name: "Coffee & snacks", emoji: "☕", colour: "#A16207", kind: "spend", group: "Everyday" },
  { id: "going_out", name: "Going out", emoji: "🍻", colour: "#DB2777", kind: "spend", group: "Everyday" },
  { id: "local_transport", name: "Local transport", emoji: "🚌", colour: "#0EA5E9", kind: "spend", group: "Everyday" },
  { id: "phone", name: "Phone & data", emoji: "📱", colour: "#6366F1", kind: "spend", group: "Everyday" },
  { id: "subscriptions", name: "Subscriptions", emoji: "🔁", colour: "#8B5CF6", kind: "spend", group: "Everyday" },
  { id: "shopping", name: "Shopping & clothes", emoji: "🛍️", colour: "#EC4899", kind: "spend", group: "Everyday" },
  { id: "health", name: "Health & toiletries", emoji: "💊", colour: "#14B8A6", kind: "spend", group: "Everyday" },
  { id: "laundry", name: "Laundry & hostel extras", emoji: "🧺", colour: "#64748B", kind: "spend", group: "Everyday" },
  { id: "gifts", name: "Gifts & souvenirs", emoji: "🎁", colour: "#E11D48", kind: "spend", group: "Everyday" },
  // Travel
  { id: "flights", name: "Flights", emoji: "✈️", colour: "#2563EB", kind: "spend", group: "Travel" },
  { id: "accommodation", name: "Accommodation", emoji: "🏨", colour: "#7C3AED", kind: "spend", group: "Travel" },
  { id: "long_distance", name: "Long-distance travel", emoji: "🚆", colour: "#0891B2", kind: "spend", group: "Travel" },
  { id: "activities", name: "Activities & tours", emoji: "🎟️", colour: "#EAB308", kind: "spend", group: "Travel" },
  { id: "visas", name: "Visas & entry fees", emoji: "🛂", colour: "#4F46E5", kind: "spend", group: "Travel" },
  { id: "insurance", name: "Travel insurance", emoji: "🛡️", colour: "#0D9488", kind: "spend", group: "Travel" },
  { id: "travel_health", name: "Vaccinations & travel health", emoji: "💉", colour: "#059669", kind: "spend", group: "Travel" },
  { id: "gear", name: "Travel gear", emoji: "🎒", colour: "#B45309", kind: "spend", group: "Travel" },
  { id: "cash", name: "Cash withdrawals", emoji: "💵", colour: "#65A30D", kind: "spend", group: "Travel" },
  { id: "fees", name: "Bank, FX & ATM fees", emoji: "💱", colour: "#DC2626", kind: "spend", group: "Travel" },
  // Money in and other
  { id: "family", name: "Family support", emoji: "👪", colour: "#16A34A", kind: "income", group: "Money in & other" },
  { id: "other_income", name: "Other income & refunds", emoji: "💰", colour: "#15803D", kind: "income", group: "Money in & other" },
  { id: "savings", name: "Savings transfers", emoji: "🏦", colour: "#94A3B8", kind: "transfer", group: "Money in & other" },
  { id: "transfers", name: "Transfers between my accounts", emoji: "🔄", colour: "#A8A29E", kind: "transfer", group: "Money in & other" },
  { id: "uncategorised", name: "Uncategorised", emoji: "❓", colour: "#9CA3AF", kind: "spend", group: "Money in & other" },
];

const byId = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): Category {
  return byId.get(id) ?? byId.get("uncategorised")!;
}

/** Transfers are moving your own money around, so they are never spending or income. */
export function isTransfer(categoryId: string): boolean {
  return getCategory(categoryId).kind === "transfer";
}
