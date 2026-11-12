import { describe, expect, it } from "vitest";
import { parsePdfLines, toPhrases, type PdfLine } from "./pdf";

// Build fake PDF lines: each cell is [x position, text]. Width is roughly 5 points per character.
function line(y: number, ...cells: [number, string][]): PdfLine {
  return { y, words: cells.map(([x, str]) => ({ x, str, width: str.length * 5 })) };
}
// Right-align an amount so it ends at `right`, like a real statement column.
function money(right: number, text: string): [number, string] {
  return [right - text.length * 5, text];
}

const HEADER = line(700,
  [40, "Date"], [110, "Payment type and details"], money(400, "Paid out"), money(470, "Paid in"), money(540, "Balance"));

describe("parsePdfLines (UK high-street bank layout)", () => {
  it("reads Paid out / Paid in columns, a date shown once per day, and descriptions split over lines", () => {
    const page = [
      line(760, [40, "Statement 1 November to 30 November 2026"]),
      HEADER,
      line(680, [40, "01 Nov"], [110, "BALANCE BROUGHT FORWARD"], money(540, "1,000.00")),
      line(660, [40, "03 Nov"], [110, "VIS"], [140, "TESCO STORES 3021"], money(400, "23.40"), money(540, "976.60")),
      line(645, [110, ")))"], [140, "PRET A MANGER"], money(400, "4.50"), money(540, "972.10")),
      line(630, [40, "05 Nov"], [110, "CR"], [140, "MUM"]),
      line(615, [140, "GAP YEAR FUND"], money(470, "200.00"), money(540, "1,172.10")),
      line(600, [110, "BALANCE CARRIED FORWARD"], money(540, "1,172.10")),
    ];
    const result = parsePdfLines([page]);
    expect(result.scanned).toBe(false);
    expect(result.foundTable).toBe(true);
    expect(result.rows).toEqual([
      { date: "2026-11-03", description: "VIS TESCO STORES 3021", amount: -2340, balance: 97660 },
      { date: "2026-11-03", description: "))) PRET A MANGER", amount: -450, balance: 97210 },
      { date: "2026-11-05", description: "CR MUM GAP YEAR FUND", amount: 20000, balance: 117210 },
    ]);
  });

  it("uses the balance change to fix the sign when there is only one amount column", () => {
    const header = line(700, [40, "Date"], [110, "Description"], money(400, "Amount"), money(540, "Balance"));
    const page = [
      header,
      line(680, [40, "10/11/2026"], [110, "Opening balance"], money(540, "500.00")),
      line(660, [40, "11/11/2026"], [110, "HOSTELWORLD"], money(400, "64.00"), money(540, "436.00")),
      line(640, [40, "12/11/2026"], [110, "REFUND RYANAIR"], money(400, "30.00"), money(540, "466.00")),
    ];
    const result = parsePdfLines([page]);
    expect(result.rows.map((r) => [r.description, r.amount])).toEqual([
      ["HOSTELWORLD", -6400],
      ["REFUND RYANAIR", 3000],
    ]);
  });

  it("rolls dates without a year from December into January", () => {
    const page = [
      line(760, [40, "Statement period 15 December 2026 to 14 January 2027"]),
      HEADER,
      line(660, [40, "30 Dec"], [110, "GRAB"], money(400, "5.00"), money(540, "95.00")),
      line(640, [40, "02 Jan"], [110, "GRAB"], money(400, "5.00"), money(540, "90.00")),
    ];
    const result = parsePdfLines([page]);
    expect(result.rows.map((r) => r.date)).toEqual(["2026-12-30", "2027-01-02"]);
  });

  it("reads statements with no header row by taking the last number as the balance", () => {
    const page = [
      line(700, [40, "Your transactions"]),
      line(680, [40, "14/11/2026 UBER TRIP"], money(400, "8.20"), money(540, "91.80")),
      line(660, [40, "15/11/2026 COSTA"], money(400, "3.10"), money(540, "88.70")),
    ];
    const result = parsePdfLines([page]);
    expect(result.rows.map((r) => [r.date, r.description, r.amount])).toEqual([
      ["2026-11-14", "UBER TRIP", -820],
      ["2026-11-15", "COSTA", -310],
    ]);
  });

  it("says when a PDF is a scanned picture with no text", () => {
    expect(parsePdfLines([[], []]).scanned).toBe(true);
  });

  it("joins words that sit next to each other into phrases", () => {
    const phrases = toPhrases([
      { x: 10, width: 20, str: "Paid" },
      { x: 32, width: 15, str: "out" },
      { x: 200, width: 30, str: "Balance" },
    ]);
    expect(phrases.map((p) => p.text)).toEqual(["Paid out", "Balance"]);
  });
});
