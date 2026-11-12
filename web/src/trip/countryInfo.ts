import data from "./data/countries.json";

// Country information cards: typical costs, money, entry rules for UK passports,
// health, safety and practical tips. Researched from official sources (GOV.UK,
// TravelHealthPro and official visa sites) on the "lastChecked" date.
// RULES CHANGE: this is a starting point to check, not guaranteed fact.
// You can edit any card in the app; your edits are saved on your device only.

export interface DailyCosts {
  accommodation: number; // £ per day
  food: number;
  transport: number;
  activities: number;
}

export interface CountryCard {
  country: string;
  flag: string;
  lastChecked: string; // YYYY-MM-DD
  summary: string;
  costs: { budget: DailyCosts; midRange: DailyCosts };
  money: { currency: string; cashOrCard: string; atms: string; tipping: string };
  entry: string[];
  health: string[];
  safety: string[];
  practical: { plugs: string; emergency: string; sim: string };
  mustKnow: string[];
  links: { label: string; url: string }[];
  sources: string[];
}

export interface EuropeInfo {
  lastChecked: string;
  ees: string[];
  etias: string[];
  schengen90180: string;
  ghic: string[];
  interrail: { passes: string[]; reservations: string[]; tips: string[] };
  links: { label: string; url: string }[];
  sources: string[];
}

export type CostStyle = "budget" | "midRange";

/** Your own changes to a card, saved on this device. */
export type CardEdits = Record<string, Partial<CountryCard>>;

export const BUILT_IN_CARDS: CountryCard[] = (data.countries as unknown as CountryCard[]).sort((a, b) => a.country.localeCompare(b.country));
export const EUROPE: EuropeInfo | null = (data.europe as unknown as EuropeInfo | null) ?? null;

const REGIONS: Record<string, string[]> = {
  Asia: ["Thailand", "Vietnam", "Cambodia", "Laos", "Indonesia", "Japan", "Malaysia", "Singapore", "Philippines", "India", "Nepal", "Sri Lanka", "South Korea"],
  Oceania: ["Australia", "New Zealand", "Fiji"],
  Americas: ["USA", "Canada", "Mexico", "Costa Rica", "Colombia", "Ecuador", "Peru", "Bolivia", "Chile", "Argentina", "Brazil"],
  Europe: [
    "France", "Spain", "Portugal", "Italy", "Germany", "Netherlands", "Belgium", "Switzerland", "Austria", "Czechia", "Poland",
    "Hungary", "Croatia", "Greece", "Ireland", "Denmark", "Sweden", "Norway", "Iceland", "United Kingdom",
  ],
};

export function regionOf(country: string): string {
  return Object.entries(REGIONS).find(([, list]) => list.includes(country))?.[0] ?? "Other";
}

export function isEurope(country: string): boolean {
  return regionOf(country) === "Europe";
}

/** A card with your edits applied on top of the built-in version. */
export function getCard(country: string, edits: CardEdits = {}): CountryCard | undefined {
  const base = BUILT_IN_CARDS.find((c) => c.country === country);
  const mine = edits[country];
  if (!base) return undefined;
  if (!mine) return base;
  return {
    ...base,
    ...mine,
    costs: { budget: { ...base.costs.budget, ...mine.costs?.budget }, midRange: { ...base.costs.midRange, ...mine.costs?.midRange } },
    money: { ...base.money, ...mine.money },
    practical: { ...base.practical, ...mine.practical },
  };
}

export function allCards(edits: CardEdits = {}): CountryCard[] {
  return BUILT_IN_CARDS.map((c) => getCard(c.country, edits)!);
}

/** Total typical cost per day in pounds for a style of travel. */
export function dailyTotal(card: CountryCard, style: CostStyle): number {
  const c = card.costs[style];
  return c.accommodation + c.food + c.transport + c.activities;
}

/** How many days old the card's information is. */
export function ageInDays(card: CountryCard, now = new Date()): number {
  return Math.floor((now.getTime() - Date.parse(card.lastChecked + "T12:00:00Z")) / 86_400_000);
}
