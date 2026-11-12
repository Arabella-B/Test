// Countries you can add to a route, with their flag and currency.
// A general list of popular gap year countries (not anyone's personal plan).

export interface CountryInfo {
  name: string;
  flag: string;
  currency: string; // ISO code, e.g. "THB"
}

export const COUNTRY_LIST: CountryInfo[] = [
  // Asia
  { name: "Thailand", flag: "🇹🇭", currency: "THB" },
  { name: "Vietnam", flag: "🇻🇳", currency: "VND" },
  { name: "Cambodia", flag: "🇰🇭", currency: "USD" }, // US dollars are widely used day to day
  { name: "Laos", flag: "🇱🇦", currency: "LAK" },
  { name: "Malaysia", flag: "🇲🇾", currency: "MYR" },
  { name: "Singapore", flag: "🇸🇬", currency: "SGD" },
  { name: "Indonesia", flag: "🇮🇩", currency: "IDR" },
  { name: "Philippines", flag: "🇵🇭", currency: "PHP" },
  { name: "Japan", flag: "🇯🇵", currency: "JPY" },
  { name: "South Korea", flag: "🇰🇷", currency: "KRW" },
  { name: "India", flag: "🇮🇳", currency: "INR" },
  { name: "Nepal", flag: "🇳🇵", currency: "NPR" },
  { name: "Sri Lanka", flag: "🇱🇰", currency: "LKR" },
  // Oceania
  { name: "Australia", flag: "🇦🇺", currency: "AUD" },
  { name: "New Zealand", flag: "🇳🇿", currency: "NZD" },
  { name: "Fiji", flag: "🇫🇯", currency: "FJD" },
  // Americas
  { name: "USA", flag: "🇺🇸", currency: "USD" },
  { name: "Canada", flag: "🇨🇦", currency: "CAD" },
  { name: "Mexico", flag: "🇲🇽", currency: "MXN" },
  { name: "Costa Rica", flag: "🇨🇷", currency: "CRC" },
  { name: "Colombia", flag: "🇨🇴", currency: "COP" },
  { name: "Ecuador", flag: "🇪🇨", currency: "USD" },
  { name: "Peru", flag: "🇵🇪", currency: "PEN" },
  { name: "Bolivia", flag: "🇧🇴", currency: "BOB" },
  { name: "Chile", flag: "🇨🇱", currency: "CLP" },
  { name: "Argentina", flag: "🇦🇷", currency: "ARS" },
  { name: "Brazil", flag: "🇧🇷", currency: "BRL" },
  // Europe
  { name: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
  { name: "France", flag: "🇫🇷", currency: "EUR" },
  { name: "Spain", flag: "🇪🇸", currency: "EUR" },
  { name: "Portugal", flag: "🇵🇹", currency: "EUR" },
  { name: "Italy", flag: "🇮🇹", currency: "EUR" },
  { name: "Germany", flag: "🇩🇪", currency: "EUR" },
  { name: "Netherlands", flag: "🇳🇱", currency: "EUR" },
  { name: "Belgium", flag: "🇧🇪", currency: "EUR" },
  { name: "Austria", flag: "🇦🇹", currency: "EUR" },
  { name: "Croatia", flag: "🇭🇷", currency: "EUR" },
  { name: "Greece", flag: "🇬🇷", currency: "EUR" },
  { name: "Ireland", flag: "🇮🇪", currency: "EUR" },
  { name: "Switzerland", flag: "🇨🇭", currency: "CHF" },
  { name: "Czechia", flag: "🇨🇿", currency: "CZK" },
  { name: "Poland", flag: "🇵🇱", currency: "PLN" },
  { name: "Hungary", flag: "🇭🇺", currency: "HUF" },
  { name: "Denmark", flag: "🇩🇰", currency: "DKK" },
  { name: "Sweden", flag: "🇸🇪", currency: "SEK" },
  { name: "Norway", flag: "🇳🇴", currency: "NOK" },
  { name: "Iceland", flag: "🇮🇸", currency: "ISK" },
  // Africa
  { name: "Morocco", flag: "🇲🇦", currency: "MAD" },
  { name: "South Africa", flag: "🇿🇦", currency: "ZAR" },
  { name: "Tanzania", flag: "🇹🇿", currency: "TZS" },
];

export function findCountry(name: string): CountryInfo | undefined {
  return COUNTRY_LIST.find((c) => c.name === name);
}

/** Every currency used by the list, plus pounds, for the currency picker. */
export const CURRENCIES = [...new Set(["GBP", ...COUNTRY_LIST.map((c) => c.currency)])].sort();
