import { describe, expect, it } from "vitest";
import { categorise, merchantName } from "./categorise";
import { buildImport, dedupeKeys } from "./importer";

describe("categorise", () => {
  it.each([
    ["CARD PAYMENT TO TESCO STORES 3021 ON 12 NOV", -2340, "groceries"],
    ["UBER *TRIP HELP.UBER.COM", -820, "local_transport"],
    ["HOSTELWORLD.COM", -6400, "accommodation"],
    ["BOOKING.COM AMSTERDAM", -9000, "accommodation"],
    ["AIRBNB * HMXYZ", -15000, "accommodation"],
    ["GRAB* A-12345 BANGKOK THB 120.00", -280, "local_transport"],
    ["INTERRAIL.EU", -40000, "long_distance"],
    ["INTERCITY NZ", -4500, "long_distance"],
    ["RYANAIR LTD", -3999, "flights"],
    ["NETFLIX.COM", -1099, "subscriptions"],
    ["STARBUCKS 1234", -395, "coffee"],
    ["NANDOS LEEDS", -1500, "eating_out"],
    ["AIRALO ESIM", -900, "phone"],
    ["WORLD NOMADS", -25000, "insurance"],
    ["NOMAD TRAVEL CLINIC", -12000, "travel_health"],
    ["ESTA APPLICATION CBP", -2100, "visas"],
    ["CASH WITHDRAWAL BANGKOK BANK", -10000, "cash"],
    ["NON-STERLING TRANSACTION FEE", -82, "fees"],
    ["NON STERLING CASH FEE", -150, "fees"],
    ["TRANSFER TO SAVINGS 12345678", -50000, "savings"],
    ["GO OUTDOORS", -6000, "gear"],
    ["BOOTS 1001", -600, "health"],
  ])("puts %s in %s", (description, amount, expected) => {
    expect(categorise(description, amount).categoryId).toBe(expected);
  });

  it("flags unknown merchants for checking instead of guessing", () => {
    expect(categorise("SQ *KOFFEE KORNER", -450)).toMatchObject({ categoryId: "uncategorised", source: "unsure" });
  });

  it("treats money back from a shop as a refund, not spending", () => {
    expect(categorise("RYANAIR REFUND", 3000).categoryId).toBe("other_income");
  });

  it("recognises family payments from the names you choose", () => {
    expect(categorise("FASTER PAYMENT FROM J SMITH MUM", 20000, { familySenders: ["Mum"] }).categoryId).toBe("family");
  });

  it("uses your own rules before the built-in list", () => {
    const result = categorise("TESCO STORES 3021", -500, { rules: [{ merchant: "TESCO STORES", categoryId: "gifts" }] });
    expect(result).toMatchObject({ categoryId: "gifts", source: "rule" });
  });

  it("spots foreign-currency spending", () => {
    expect(categorise("7-ELEVEN BANGKOK THB 85.00 @ RATE 44.1", -193).isForeign).toBe(true);
    expect(categorise("TESCO STORES", -193).isForeign).toBe(false);
  });
});

describe("merchantName", () => {
  it("strips bank words, card numbers and dates", () => {
    expect(merchantName("CARD PAYMENT TO TESCO STORES 3021 ON 12 NOV")).toBe("TESCO STORES");
    expect(merchantName("CONTACTLESS PRET A MANGER")).toBe("PRET A MANGER");
  });
});

describe("duplicates", () => {
  const rows = [
    { date: "2026-11-12", description: "COSTA", amount: -310 },
    { date: "2026-11-12", description: "COSTA", amount: -310 },
    { date: "2026-11-13", description: "LIDL", amount: -999 },
  ];

  it("keeps two genuine identical purchases on the same day", () => {
    const keys = dedupeKeys(rows);
    expect(new Set(keys).size).toBe(3);
  });

  it("skips transactions already imported from an overlapping statement", () => {
    const existing = new Set<string>();
    const opts = { rules: [], familySenders: [], source: "csv" as const, importId: "a" };
    const first = buildImport(rows, existing, opts);
    expect(first.added).toHaveLength(3);
    const overlap = buildImport([...rows, { date: "2026-11-14", description: "GRAB", amount: -500 }], existing, opts);
    expect(overlap.added).toHaveLength(1);
    expect(overlap.duplicates).toBe(3);
  });
});
