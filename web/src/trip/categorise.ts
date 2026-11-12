import { KEYWORD_RULES } from "./merchants";
import type { CategorySource, MerchantRule } from "./types";

// Words banks add to descriptions that say nothing about the merchant.
const NOISE = new Set([
  "CARD", "PAYMENT", "PAYMENTS", "TO", "FROM", "DEBIT", "CREDIT", "CONTACTLESS", "POS", "VIS", "VISA", "MASTERCARD",
  "DD", "SO", "BP", "CR", "DR", "FPO", "FPI", "BGC", "CPT", "DEB", "TFR", "CHG", "PURCHASE", "ON", "AT", "REF", "GBP", "CLEARPAY", "DIRECT", "STANDING", "ORDER", "FASTER", "BANK", "GIRO", "ONLINE", "TRANSACTION",
  "THE", "LTD", "LIMITED", "PLC", "UK", "GB", "COM", "WWW", "CO", "INC", "LLC",
  // Card-reader and payment-provider prefixes (Square, SumUp, Zettle, PayPal, Curve)
  "SQ", "SUMUP", "IZ", "ZETTLE", "PAYPAL", "PP", "CRV", "CURVE",
]);

const MONTH_WORDS = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)$/;

/** Turn a description into capitals with punctuation as spaces, e.g. "Uber *Trip" → "UBER TRIP". */
export function normalise(text: string): string {
  return text.toUpperCase().replace(/&/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();
}

/**
 * A short, tidy merchant name used for grouping, rules and "top merchants".
 * "CARD PAYMENT TO TESCO STORES 3021 ON 12 NOV" → "TESCO STORES".
 */
export function merchantName(description: string): string {
  const words = normalise(description)
    .replace(/\b(APPLE|GOOGLE) PAY\b/g, " ")
    .split(" ")
    .filter((w) => w && !NOISE.has(w) && !MONTH_WORDS.test(w) && !/\d{2,}/.test(w) && !/^\d$/.test(w));
  // Keep the first two real words (a one-letter word like the "A" in "PRET A MANGER" doesn't count).
  const picked: string[] = [];
  for (const w of words) {
    picked.push(w);
    if (picked.filter((p) => p.length > 1).length >= 2 || picked.length >= 3) break;
  }
  const name = picked.join(" ");
  return name || normalise(description).slice(0, 24) || "UNKNOWN";
}

// Pre-compute " KEYWORD " strings once so matching is fast.
const COMPILED = KEYWORD_RULES.map((r) => ({
  categoryId: r.categoryId,
  keywords: r.keywords.map((k) => ` ${normalise(k)} `),
}));

/** Signs that a payment was in another currency (codes, exchange rates, fee lines). */
const FOREIGN_PATTERN =
  / (USD|EUR|THB|VND|NZD|PEN|BOB|CHF|CZK|PLN|HUF|DKK|SEK|NOK|AUD|JPY|SGD|MYR|KHR|LAK|IDR) | RATE | EXCHANGE | FX | NON STERLING | NON GBP | FOREIGN /;

export interface CategoryResult {
  categoryId: string;
  source: CategorySource;
  isForeign: boolean;
}

export interface CategoriseOptions {
  rules?: MerchantRule[];
  familySenders?: string[];
}

/**
 * Pick a category for one transaction.
 * Order: your own saved rules → family senders → built-in keywords → money-in fallback.
 * Anything not matched is "Uncategorised" and flagged as unsure for checking.
 */
export function categorise(description: string, amount: number, options: CategoriseOptions = {}): CategoryResult {
  const text = ` ${normalise(description)} `;
  const merchant = merchantName(description);
  const isForeign = FOREIGN_PATTERN.test(text);

  const rule = options.rules?.find((r) => r.merchant === merchant);
  if (rule) return { categoryId: rule.categoryId, source: "rule", isForeign };

  if (amount > 0) {
    const family = options.familySenders?.map((s) => normalise(s)).filter(Boolean) ?? [];
    if (family.some((name) => text.includes(` ${name} `))) {
      return { categoryId: "family", source: "keyword", isForeign };
    }
  }

  for (const rule of COMPILED) {
    if (rule.keywords.some((k) => text.includes(k))) {
      // Money coming back from a shop or airline is a refund, not spending.
      const spendCategory = !["savings", "transfers", "fees"].includes(rule.categoryId);
      if (amount > 0 && spendCategory) return { categoryId: "other_income", source: "keyword", isForeign };
      return { categoryId: rule.categoryId, source: "keyword", isForeign };
    }
  }

  if (amount > 0) return { categoryId: "other_income", source: "unsure", isForeign };
  return { categoryId: "uncategorised", source: "unsure", isForeign };
}
