import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatMoney, parseAmount, parseUkDate } from "./money";

describe("parseUkDate", () => {
  it.each([
    ["05/11/2026", "2026-11-05"],
    ["5/11/26", "2026-11-05"],
    ["05-11-2026", "2026-11-05"],
    ["05.11.2026", "2026-11-05"],
    ["5 Nov 2026", "2026-11-05"],
    ["05 Nov 26", "2026-11-05"],
    ["05Nov26", "2026-11-05"],
    ["5 November 2026", "2026-11-05"],
    ["2026-11-05", "2026-11-05"],
  ])("reads %s as %s (day first, UK style)", (input, expected) => {
    expect(parseUkDate(input)).toBe(expected);
  });

  it("uses the fallback year for dates printed without one", () => {
    expect(parseUkDate("12 Nov", 2026)).toBe("2026-11-12");
  });

  it("rejects things that aren't real dates", () => {
    expect(parseUkDate("31/02/2026")).toBeNull();
    expect(parseUkDate("13/13/2026")).toBeNull();
    expect(parseUkDate("TESCO")).toBeNull();
    expect(parseUkDate("12.50")).toBeNull();
  });
});

describe("parseAmount", () => {
  it.each([
    ["12.30", 1230],
    ["-12.30", -1230],
    ["£1,234.56", 123456],
    ["-£1,234.56", -123456],
    ["12.30 CR", 1230],
    ["12.30DR", -1230],
    ["(12.30)", -1230],
    ["+5", 500],
    ["0.99", 99],
  ])("reads %s as %i pence", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("returns null for text", () => {
    expect(parseAmount("TESCO")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12/11/2026")).toBeNull();
  });
});

describe("date and money helpers", () => {
  it("formats pence as pounds", () => {
    expect(formatMoney(123456)).toBe("£1,234.56");
    expect(formatMoney(-500)).toBe("-£5.00");
  });
  it("adds and counts days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(daysBetween("2026-11-01", "2026-12-01")).toBe(30);
  });
});
