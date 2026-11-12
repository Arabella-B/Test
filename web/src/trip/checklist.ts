import { addDays, daysBetween, today } from "./money";
import type { ChecklistItem } from "./types";

// A general pre-departure checklist for a long trip from the UK.
// `daysBefore` sets the due date, counted back from your departure date.
// Rules and advice change: always check gov.uk foreign travel advice.
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: "clinic", daysBefore: 42, done: false,
    title: "Book a travel clinic appointment",
    detail: "Some vaccines need several weeks or several doses. Book now even if you leave soon. See TravelHealthPro / NHS fitfortravel for each country.",
  },
  {
    id: "passport", daysBefore: 35, done: false,
    title: "Check your passport",
    detail: "Many countries want 6+ months' validity after you leave them, and blank pages.",
  },
  {
    id: "visas", daysBefore: 28, done: false,
    title: "Apply for visas and travel permits",
    detail: "Check each country on gov.uk foreign travel advice (e.g. ESTA for the USA, NZeTA for New Zealand, e-visas for some countries). Only use official sites.",
  },
  {
    id: "insurance", daysBefore: 21, done: false,
    title: "Buy travel insurance that covers everything",
    detail: "Every region you'll visit (the USA is often extra), plus trekking at altitude, adventure sports, scuba and scooters if you might do them.",
  },
  {
    id: "card", daysBefore: 21, done: false,
    title: "Get a fee-free travel debit card",
    detail: "High-street cards often add ~3% per foreign purchase plus cash fees. Keep your main card as a backup, stored separately.",
  },
  {
    id: "ghic", daysBefore: 21, done: false,
    title: "Get a GHIC card (for Europe)",
    detail: "It's free from the NHS website. Avoid unofficial sites that charge.",
  },
  {
    id: "emergency", daysBefore: 14, done: false,
    title: "Set aside an emergency fund",
    detail: "Enough for a flight home or a medical excess, kept separate from everyday money.",
  },
  {
    id: "bank", daysBefore: 14, done: false,
    title: "Tell your bank you're travelling",
    detail: "And check its overseas fees and how to contact it from abroad.",
  },
  {
    id: "statements", daysBefore: 14, done: false,
    title: "Find your bank's statement download",
    detail: "Check whether it gives CSV or PDF, so you can import statements here.",
  },
  {
    id: "rail", daysBefore: 14, done: false,
    title: "Book rail passes and key seat reservations",
    detail: "Some fast trains need reservations with a pass and they sell out.",
  },
  {
    id: "subs", daysBefore: 7, done: false,
    title: "Pause or cancel subscriptions you won't use",
  },
  {
    id: "copies", daysBefore: 7, done: false,
    title: "Save digital copies of important documents",
    detail: "Passport, insurance policy and emergency number, card helplines.",
  },
  {
    id: "esim", daysBefore: 5, done: false,
    title: "Plan an eSIM or SIM for each region",
  },
  {
    id: "backup", daysBefore: 1, done: false,
    title: "Back up this app",
    detail: "Settings → Export a backup, and keep the file somewhere safe (e.g. iCloud Drive).",
  },
];

export type Urgency = "overdue" | "soon" | "upcoming" | "done";

export function dueDate(item: ChecklistItem, departureDate: string): string {
  return addDays(departureDate, -item.daysBefore);
}

export function urgency(item: ChecklistItem, departureDate: string, now = today()): Urgency {
  if (item.done) return "done";
  const left = daysBetween(now, dueDate(item, departureDate));
  if (left <= 2) return "overdue";
  if (left <= 10) return "soon";
  return "upcoming";
}

/** Not done first, most urgent first; done items at the bottom. */
export function sortChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.daysBefore - a.daysBefore || a.title.localeCompare(b.title);
  });
}
