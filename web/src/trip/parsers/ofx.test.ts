import { describe, expect, it } from "vitest";
import { parseRowsStatement } from "./csv";
import { cellToText, sheetToRows } from "./excel";
import { parseOfx, parseQif } from "./ofx";

describe("OFX", () => {
  it("reads old-style OFX with unclosed tags", () => {
    const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261103
<TRNAMT>-23.40
<FITID>1
<NAME>TESCO STORES 3021
<MEMO>CARD PAYMENT
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261105120000[0:GMT]
<TRNAMT>150.00
<NAME>FROM DAD
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    expect(parseOfx(ofx)).toEqual([
      { date: "2026-11-03", description: "TESCO STORES 3021 CARD PAYMENT", amount: -2340 },
      { date: "2026-11-05", description: "FROM DAD", amount: 15000 },
    ]);
  });

  it("reads XML-style OFX, & signs and comma decimals", () => {
    const ofx = `<?xml version="1.0"?><OFX><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261110</DTPOSTED>` +
      `<TRNAMT>-4,50</TRNAMT><NAME>M&amp;S SIMPLY FOOD</NAME></STMTTRN></OFX>`;
    expect(parseOfx(ofx)).toEqual([{ date: "2026-11-10", description: "M&S SIMPLY FOOD", amount: -450 }]);
  });
});

describe("QIF", () => {
  it("reads QIF with UK day-first dates and the 'year style", () => {
    const qif = `!Type:Bank
D12/11/2026
T-6.00
PBOOTS 1101
^
D13/11'26
T-1,250.00
PHOSTELWORLD
MBooking ref 123
^`;
    expect(parseQif(qif)).toEqual([
      { date: "2026-11-12", description: "BOOTS 1101", amount: -600 },
      { date: "2026-11-13", description: "HOSTELWORLD Booking ref 123", amount: -125000 },
    ]);
  });
});

describe("Excel", () => {
  it("turns spreadsheet cells into text the statement reader understands", () => {
    expect(cellToText(new Date(Date.UTC(2026, 10, 3)))).toBe("03/11/2026");
    expect(cellToText(-23.4)).toBe("-23.4");
    expect(cellToText(null)).toBe("");
  });

  it("reads a sheet like a CSV statement", () => {
    const sheet = [
      ["Account: Sample", null, null, null],
      ["Date", "Description", "Paid out", "Paid in"],
      [new Date(Date.UTC(2026, 10, 3)), "LIDL", 18.2, null],
      [new Date(Date.UTC(2026, 10, 5)), "FROM MUM", null, 100],
    ];
    const result = parseRowsStatement(sheetToRows(sheet));
    expect(result.ok && result.rows).toEqual([
      { date: "2026-11-03", description: "LIDL", amount: -1820, balance: undefined },
      { date: "2026-11-05", description: "FROM MUM", amount: 10000, balance: undefined },
    ]);
  });
});
