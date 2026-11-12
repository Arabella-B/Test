// Shared shapes for the private "My Trip" section.
// All money is stored in pence (whole numbers) to avoid rounding errors:
// £12.34 is stored as 1234. Money going out is negative, money coming in is positive.

export type CategoryKind = "spend" | "income" | "transfer";

export interface Category {
  id: string;
  name: string;
  emoji: string;
  colour: string; // hex colour used everywhere this category appears
  kind: CategoryKind;
  group: "Everyday" | "Travel" | "Money in & other";
}

/** How the category was chosen, so we know what to flag for checking. */
export type CategorySource = "keyword" | "rule" | "user" | "unsure";

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string; // as written on the statement
  merchant: string; // cleaned-up name used for grouping and rules
  amount: number; // pence; negative = money out
  balance?: number; // pence, if the statement shows it
  categoryId: string;
  categorySource: CategorySource;
  isForeign: boolean; // looks like a foreign-currency transaction
  source: "csv" | "pdf" | "demo" | "manual";
  importId: string;
  dedupeKey: string;
  // Cash spending added by hand in another currency:
  currency?: string; // e.g. "THB"
  localAmount?: number; // in that currency, e.g. 250 (positive)
  note?: string;
}

/** A transaction read from a statement, before categorising. */
export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  balance?: number;
}

export interface TripSettings {
  totalBudget: number; // pence: money available for the gap year at the start
  budgetStartDate: string; // count spending from this day
  departureDate: string;
  returnDate: string;
  familySupportMonthly: number; // pence expected each month from family
  familySenders: string[]; // words that identify family payments, e.g. "MUM"
  homeCurrency: "GBP";
  lastBackupAt?: string; // ISO date-time
  /**
   * True once you log cash spending by hand. Then ATM withdrawals aren't counted as
   * spending (the cash you spend is), so nothing is counted twice.
   */
  trackCashSpending?: boolean;
}

/** One country on your route. */
export interface TripStop {
  id: string;
  country: string;
  flag: string;
  currency: string;
  startDate: string; // YYYY-MM-DD, first day there
  endDate: string; // YYYY-MM-DD, last day there
  dailyBudget: number; // pence per day
}

/** A monthly spending limit for one category. */
export interface CategoryBudget {
  categoryId: string;
  monthly: number; // pence
}

export interface ChecklistItem {
  id: string;
  title: string;
  detail?: string;
  daysBefore: number; // due this many days before departure (0 = departure day)
  done: boolean;
  custom?: boolean;
}

/** A learned rule: transactions from this merchant go in this category. */
export interface MerchantRule {
  merchant: string;
  categoryId: string;
}

/** A remembered column choice for a CSV layout. */
export interface ColumnMapping {
  signature: string; // the header row, joined, used to recognise the layout next time
  date: number;
  description: number;
  amount?: number;
  paidOut?: number;
  paidIn?: number;
  balance?: number;
}
