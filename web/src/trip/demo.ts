import { addDays, today } from "./money";
import type { ParsedRow, TripSettings } from "./types";

// Made-up sample data for "Alex", an imaginary traveller, so you can see the
// app working before using your own statements. None of this is real.

/** A tiny seeded random number generator, so the demo looks the same each time. */
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function demoSettings(now = today()): TripSettings {
  return {
    totalBudget: 1_200_000, // £12,000
    budgetStartDate: addDays(now, -100),
    departureDate: addDays(now, -60),
    returnDate: addDays(now, 95),
    familySupportMonthly: 25_000, // £250
    familySenders: ["MUM"],
    homeCurrency: "GBP",
  };
}

export function demoRows(now = today()): ParsedRow[] {
  const rnd = random(42);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const between = (min: number, max: number) => Math.round(min + rnd() * (max - min));
  const rows: ParsedRow[] = [];
  const start = addDays(now, -100);
  const depart = addDays(now, -60);
  const vietnam = addDays(now, -25);

  const add = (date: string, description: string, pence: number) => rows.push({ date, description, amount: pence });
  /** A foreign card payment plus the bank's 2.99% non-sterling fee line. */
  const foreign = (date: string, description: string, pence: number) => {
    add(date, description, -pence);
    add(date, "NON-STERLING TRANSACTION FEE", -Math.max(1, Math.round(pence * 0.0299)));
  };

  // One-off trip costs before leaving
  add(addDays(start, 3), "THAI AIRWAYS INTERNATIONAL", -62_000);
  add(addDays(start, 5), "WORLD NOMADS INSURANCE", -31_000);
  add(addDays(start, 9), "NOMAD TRAVEL CLINIC LONDON", -18_500);
  add(addDays(start, 14), "GO OUTDOORS LEEDS", -12_000);
  add(addDays(start, 20), "AIRALO ESIM", -1_800);
  add(addDays(start, 12), "TRANSFER TO SAVINGS 40512345", -50_000);
  add(addDays(start, 30), "TRANSFER FROM SAVINGS 40512345", 50_000);

  for (let i = 0; i <= 100; i++) {
    const date = addDays(start, i);
    const day = +date.slice(8, 10);

    // Monthly bits
    if (day === 1) add(date, "FASTER PAYMENT FROM MUM", 25_000);
    if (day === 3) add(date, "NETFLIX.COM", -1_099);
    if (day === 7) add(date, "SPOTIFY P1234", -1_199);
    if (day === 12) add(date, "PUREGYM LTD", -2_499);
    if (day === 18) add(date, "APPLE.COM/BILL ICLOUD", -299);

    if (date < depart) {
      // At home in the UK
      if (rnd() < 0.45) add(date, pick(["TESCO STORES 3021", "ALDI 85", "SAINSBURYS S/MKT"]), -between(600, 3_800));
      if (rnd() < 0.4) add(date, pick(["COSTA COFFEE", "PRET A MANGER", "GREGGS"]), -between(250, 690));
      if (rnd() < 0.15) add(date, pick(["NANDOS LEEDS", "WAGAMAMA", "FIVE GUYS"]), -between(1_200, 2_600));
      if (rnd() < 0.1) add(date, pick(["JD WETHERSPOON", "BREWDOG LEEDS"]), -between(900, 2_800));
      if (rnd() < 0.08) add(date, "BOOTS 1101", -between(300, 1_500));
    } else {
      const inVietnam = date >= vietnam;
      const cur = inVietnam ? "VND" : "THB";
      const city = inVietnam ? pick(["HANOI", "HOI AN", "HO CHI MINH"]) : pick(["BANGKOK", "CHIANG MAI", "KOH TAO"]);
      // Travelling: food, rides, beds, fun, with foreign fees on each payment
      if (rnd() < 0.85) foreign(date, `${inVietnam ? "CIRCLE K" : "7-ELEVEN"} ${city} ${cur}`, between(150, 600));
      if (rnd() < 0.7) foreign(date, `${inVietnam ? "PHO" : "STREET FOOD"} RESTAURANT ${city} ${cur}`, between(250, 1_100));
      if (rnd() < 0.35) foreign(date, `${inVietnam ? "HIGHLANDS COFFEE" : "CAFE AMAZON"} ${city} ${cur}`, between(120, 350));
      if (rnd() < 0.45) foreign(date, `GRAB* ${city} ${cur}`, between(150, 900));
      if (rnd() < 0.12) foreign(date, `${pick(["HOSTELWORLD", "AGODA", "BOOKING.COM"])} ${city}`, between(2_500, 7_500));
      if (rnd() < 0.08) foreign(date, `KLOOK ${pick(["DIVE TRIP", "COOKING CLASS", "TEMPLE TOUR"])} ${cur}`, between(1_500, 6_000));
      if (rnd() < 0.15) foreign(date, `BAR ${city} ${cur}`, between(300, 1_500));
      if (rnd() < 0.06) foreign(date, `LAUNDRY ${city} ${cur}`, between(150, 300));
      if (rnd() < 0.1) {
        add(date, `CASH WITHDRAWAL ${inVietnam ? "VIETCOMBANK" : "BANGKOK BANK"} ${cur}`, -between(4_000, 9_000));
        add(date, "NON-STERLING CASH FEE", -150);
        if (!inVietnam) add(date, "ATM FEE BANGKOK BANK THB", -495);
      }
      if (rnd() < 0.03) add(date, `SQ *${pick(["MAMA NOI", "BAAN SUAN", "LUCKY 88"])} ${cur}`, -between(200, 900));
    }
  }

  // A double charge to spot
  const d = addDays(now, -6);
  add(d, "KLOOK ISLAND BOAT TRIP THB", -3_450);
  add(d, "KLOOK ISLAND BOAT TRIP THB", -3_450);

  return rows.filter((r) => r.date <= now).sort((a, b) => a.date.localeCompare(b.date));
}
