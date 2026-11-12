// Helpers for reading and showing money and dates the UK way.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1) return null; // e.g. 31/02
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Read a UK-style date and return it as YYYY-MM-DD, or null if it isn't a date.
 * Handles 05/11/2026, 5/11/26, 05-11-2026, 05.11.2026, 5 Nov 2026, 05 Nov 26,
 * 05Nov26, and 2026-11-05. `fallbackYear` fills in dates like "5 Nov" that
 * some PDF statements print without a year.
 */
export function parseUkDate(text: string, fallbackYear?: number): string | null {
  const s = text.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return validDate(+m[3], +m[2], +m[1]);

  m = s.match(/^(\d{1,2})\s*([A-Za-z]{3,4})[a-z]*\.?\s*,?\s*(\d{2}|\d{4})?$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase().slice(0, 3)];
    const year = m[3] ? +m[3] : fallbackYear;
    if (month && year) return validDate(year, month, +m[1]);
  }
  return null;
}

/**
 * Read an amount like "£1,234.56", "-12.30", "12.30 CR", "12.30DR" or "(12.30)"
 * and return pence. Returns null if the text isn't an amount.
 * CR (credit) means money in; DR (debit) or brackets mean money out.
 */
export function parseAmount(text: string): number | null {
  let s = text.trim().replace(/[£\s]/g, "").replace(/GBP/i, "");
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (/DR$/i.test(s)) { sign = -1; s = s.slice(0, -2); }
  else if (/CR$/i.test(s)) { s = s.slice(0, -2); }
  if (s.startsWith("-")) { sign *= -1; s = s.slice(1); }
  else if (s.startsWith("+")) { s = s.slice(1); }
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(s)) return null;
  const value = Math.round(parseFloat(s.replace(/,/g, "")) * 100);
  return sign * value;
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const gbpRound = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/** Show pence as pounds, e.g. 123456 → "£1,234.56". */
export function formatMoney(pence: number, round = false): string {
  return (round ? gbpRound : gbp).format(pence / 100);
}

/** Today's date as YYYY-MM-DD in the user's own time zone. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86_400_000);
}

export function formatDate(date: string, style: "short" | "long" = "short"): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}
