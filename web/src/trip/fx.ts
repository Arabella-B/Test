// Exchange rates: how many of each currency you get for £1.
// Rates come from ExchangeRate-API's free service (https://www.exchangerate-api.com).
// The app downloads ALL rates at once, so the service learns nothing about where
// you're going. Rates are saved on your device so conversion works offline.

export interface FxRates {
  date: string; // when the rates were published (YYYY-MM-DD)
  fetchedAt: string; // when this device last downloaded them (ISO)
  rates: Record<string, number>; // units per £1
  source: "live" | "built-in";
}

/** Built-in backup rates (12 Nov 2026), used until fresh rates can be downloaded. */
export const BUILT_IN_RATES: FxRates = {
  date: "2026-11-12",
  fetchedAt: "",
  source: "built-in",
  rates: {
    GBP: 1, THB: 44.84, VND: 34111, USD: 1.329, LAK: 29828, MYR: 5.4164, SGD: 1.7063, IDR: 24139, PHP: 84.09,
    JPY: 212.03, KRW: 1779, INR: 124.61, NPR: 199.39, LKR: 442.41, AUD: 1.9402, NZD: 2.3853, FJD: 3.0052,
    CAD: 1.8921, MXN: 24.74, CRC: 602.39, COP: 4407, PEN: 4.556, BOB: 15.71, CLP: 1309, ARS: 2057, BRL: 7.4062,
    EUR: 1.1963, CHF: 1.1046, CZK: 29.16, PLN: 5.2729, HUF: 436.51, DKK: 8.9394, SEK: 13.23, NOK: 12.68, ISK: 163.54,
    MAD: 13.04, ZAR: 22.04, TZS: 3493,
  },
};

const FX_URL = "https://open.er-api.com/v6/latest/GBP";

/** Download today's rates. Returns null if offline or the service is down. */
export async function fetchRates(): Promise<FxRates | null> {
  try {
    const res = await fetch(FX_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result !== "success" || typeof data.rates !== "object") return null;
    const published = new Date(data.time_last_update_utc ?? Date.now()).toISOString().slice(0, 10);
    return { date: published, fetchedAt: new Date().toISOString(), rates: data.rates, source: "live" };
  } catch {
    return null;
  }
}

/** True if the saved rates are more than 12 hours old (or built-in). */
export function ratesAreStale(fx: FxRates): boolean {
  if (fx.source === "built-in" || !fx.fetchedAt) return true;
  return Date.now() - Date.parse(fx.fetchedAt) > 12 * 3_600_000;
}

/** Convert an amount in a local currency to pence. E.g. 250 THB → 558 pence. */
export function toPence(amount: number, currency: string, fx: FxRates): number {
  const rate = fx.rates[currency] ?? BUILT_IN_RATES.rates[currency];
  if (!rate) throw new Error(`No exchange rate for ${currency}`);
  return Math.round((amount / rate) * 100);
}

/** Convert pence to a local currency amount. */
export function fromPence(pence: number, currency: string, fx: FxRates): number {
  const rate = fx.rates[currency] ?? BUILT_IN_RATES.rates[currency] ?? 1;
  return (pence / 100) * rate;
}

/** Show an amount in its own currency, e.g. "฿250", "₫120,000", "NZ$12.50". */
export function formatLocal(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
