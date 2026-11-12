import { describe, expect, it } from "vitest";
import { applyMapping, parseCsvStatement } from "./csv";

describe("parseCsvStatement", () => {
  it("reads a single Amount column (Barclays/HSBC style)", () => {
    const csv = `Date,Description,Amount,Balance
05/11/2026,CARD PAYMENT TO TESCO STORES 3021,-23.40,976.60
06/11/2026,FROM MUM,200.00,1176.60`;
    const result = parseCsvStatement(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      { date: "2026-11-05", description: "CARD PAYMENT TO TESCO STORES 3021", amount: -2340, balance: 97660 },
      { date: "2026-11-06", description: "FROM MUM", amount: 20000, balance: 117660 },
    ]);
  });

  it("reads separate Paid out / Paid in columns with £ signs and details above the table (Nationwide style)", () => {
    const csv = `"Account Name:","FlexAccount ****1234"
"Account Balance:","£1,000.00"

"Date","Transaction type","Description","Paid out","Paid in","Balance"
"07 Nov 2026","Contactless Payment","PRET A MANGER","£4.50","","£995.50"
"08 Nov 2026","Bank credit","SALARY","","£1,250.00","£2,245.50"`;
    const result = parseCsvStatement(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => [r.date, r.description, r.amount])).toEqual([
      ["2026-11-07", "PRET A MANGER", -450],
      ["2026-11-08", "SALARY", 125000],
    ]);
  });

  it("reads Debit Amount / Credit Amount columns (Lloyds style)", () => {
    const csv = `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
09/11/2026,DEB,'11-22-33,12345678,HOSTELWORLD,64.00,,500.00
10/11/2026,FPI,'11-22-33,12345678,DAD,,100.00,600.00`;
    const result = parseCsvStatement(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => [r.description, r.amount])).toEqual([
      ["HOSTELWORLD", -6400],
      ["DAD", 10000],
    ]);
  });

  it("reads a Monzo-style export where the merchant is in the Name column", () => {
    const csv = `Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency
tx_1,11/11/2026,09:12:00,Card payment,Starbucks,☕,Eating out,-3.95,GBP`;
    const result = parseCsvStatement(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({ description: "Starbucks", amount: -395 });
  });

  it("guesses columns when there is no header row", () => {
    const csv = `12/11/2026,UBER *TRIP,-8.20,100.00
12/11/2026,GREGGS,-2.10,97.90`;
    const result = parseCsvStatement(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => r.amount)).toEqual([-820, -210]);
  });

  it("asks for column matching when it can't work the columns out", () => {
    const csv = `When,What,How much
yesterday,coffee,lots`;
    const result = parseCsvStatement(csv);
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "needs-mapping") return;
    expect(result.header).toEqual(["When", "What", "How much"]);
  });

  it("uses a saved column choice for a known layout, even when guessing would pick wrongly", () => {
    // Without a saved choice, the reference number column looks like the amount.
    const csv = `Posted,Info,Ref,Money
13/11/2026,BOOTS,123,-6.00`;
    const saved = { signature: "posted|info|ref|money", date: 0, description: 1, amount: 3 };
    const result = parseCsvStatement(csv, [saved]);
    expect(result.ok && result.rows[0]).toMatchObject({ description: "BOOTS", amount: -600 });
  });

  it("skips rows that aren't transactions", () => {
    const { rows, skipped } = applyMapping(
      [["01/11/2026", "OPENING BALANCE", ""], ["02/11/2026", "LIDL", "-9.99"], ["", "", ""]],
      { date: 0, description: 1, amount: 2 },
    );
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(2);
  });
});
