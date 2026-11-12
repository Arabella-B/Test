import Papa from "papaparse";
import { parseAmount, parseUkDate } from "../money";
import type { ColumnMapping, ParsedRow } from "../types";

// Reads CSV bank statements. It finds the header row, works out which column
// is which (date, description, amount or paid out / paid in, balance) and turns
// each row into a transaction. If it can't tell, it asks you to match the
// columns yourself, and remembers your choice for next time.

type Field = "date" | "description" | "amount" | "paidOut" | "paidIn" | "balance";

// Header names used by UK banks, best match first.
const HEADER_NAMES: Record<Field, string[]> = {
  date: ["date", "transaction date", "posting date", "posted date", "completed date", "value date", "started date"],
  description: [
    "description", "transaction description", "details", "transaction details", "name", "merchant", "narrative",
    "payee", "memo", "reference", "counter party", "counterparty",
  ],
  amount: ["amount", "value", "transaction amount", "amount gbp", "net amount"],
  paidOut: ["paid out", "money out", "debit", "debit amount", "debits", "withdrawals", "withdrawal", "out", "spent"],
  paidIn: ["paid in", "money in", "credit", "credit amount", "credits", "deposits", "deposit", "in", "received"],
  balance: ["balance", "running balance", "balance gbp", "account balance"],
};

export function normaliseHeader(cell: string): string {
  return cell.toLowerCase().replace(/\(.*?\)|£|gbp/g, " ").replace(/[^a-z]+/g, " ").trim();
}

/** Work out column positions from a header row. Returns null for fields it can't find. */
export function detectColumns(header: string[]): Partial<Record<Field, number>> {
  const cells = header.map(normaliseHeader);
  const found: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  for (const field of Object.keys(HEADER_NAMES) as Field[]) {
    for (const name of HEADER_NAMES[field]) {
      const index = cells.findIndex((c, i) => !used.has(i) && c === name);
      if (index >= 0) { found[field] = index; used.add(index); break; }
    }
  }
  return found;
}

function looksLikeHeader(row: string[]): boolean {
  const cols = detectColumns(row);
  return cols.date !== undefined && (cols.amount !== undefined || cols.paidOut !== undefined || cols.paidIn !== undefined);
}

export type CsvResult =
  | { ok: true; rows: ParsedRow[]; skipped: number; signature: string }
  | {
      ok: false;
      reason: "needs-mapping";
      header: string[];
      dataRows: string[][];
      signature: string;
    }
  | { ok: false; reason: "empty" };

export function readCsvRows(text: string): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  return result.data.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

/** Turn data rows into transactions using a column mapping. Rows that aren't transactions are skipped. */
export function applyMapping(dataRows: string[][], mapping: Omit<ColumnMapping, "signature">): { rows: ParsedRow[]; skipped: number } {
  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (const cells of dataRows) {
    const date = parseUkDate(cells[mapping.date] ?? "");
    const description = (cells[mapping.description] ?? "").replace(/\s+/g, " ").trim();
    let amount: number | null = null;
    if (mapping.amount !== undefined) {
      amount = parseAmount(cells[mapping.amount] ?? "");
    } else {
      // Separate "Paid out" and "Paid in" columns: paid out is always money leaving.
      const out = parseAmount(cells[mapping.paidOut ?? -1] ?? "");
      const inn = parseAmount(cells[mapping.paidIn ?? -1] ?? "");
      if (out) amount = -Math.abs(out);
      else if (inn) amount = Math.abs(inn);
    }
    if (!date || amount === null || amount === 0) { skipped++; continue; }
    const balance = mapping.balance !== undefined ? parseAmount(cells[mapping.balance] ?? "") ?? undefined : undefined;
    rows.push({ date, description: description || "(no description)", amount, balance });
  }
  return { rows, skipped };
}

/**
 * Read a CSV statement. `savedMappings` are column choices you made before;
 * if this file has the same header row, the saved choice is used.
 */
export function parseCsvStatement(text: string, savedMappings: ColumnMapping[] = []): CsvResult {
  return parseRowsStatement(readCsvRows(text), savedMappings);
}

/**
 * The same detection for any table of rows (CSV, or a sheet read from an Excel file).
 * Empty rows are ignored.
 */
export function parseRowsStatement(rows: string[][], savedMappings: ColumnMapping[] = []): CsvResult {
  const all = rows.filter((r) => r.some((c) => c.trim()));
  if (all.length === 0) return { ok: false, reason: "empty" };

  // Some banks put account details above the table, so look a few rows down.
  const headerIndex = all.slice(0, 20).findIndex(looksLikeHeader);
  const header = headerIndex >= 0 ? all[headerIndex] : all.slice(0, 20).find((r) => r.length >= 3) ?? all[0];
  const startRow = headerIndex >= 0 ? headerIndex + 1 : all.indexOf(header) + (rowHasDate(header) ? 0 : 1);
  const dataRows = all.slice(startRow).filter((r) => r.some((c) => c));
  const signature = header.map(normaliseHeader).join("|");

  const saved = savedMappings.find((m) => m.signature === signature);
  if (saved) return { ok: true, signature, ...applyMapping(dataRows, saved) };

  if (headerIndex >= 0) {
    const cols = detectColumns(header);
    if (cols.description === undefined) cols.description = guessDescriptionColumn(dataRows, cols);
    if (cols.date !== undefined && cols.description !== undefined) {
      return { ok: true, signature, ...applyMapping(dataRows, cols as ColumnMapping) };
    }
  } else {
    // No header (some banks export without one): guess from the contents.
    const guessed = guessFromContent(dataRows);
    if (guessed) return { ok: true, signature, ...applyMapping(dataRows, guessed) };
  }

  return { ok: false, reason: "needs-mapping", header, dataRows, signature };
}

function rowHasDate(row: string[]): boolean {
  return row.some((c) => parseUkDate(c) !== null);
}

/** The description is usually the column with the longest text that isn't a date or number. */
function guessDescriptionColumn(rows: string[][], taken: Partial<Record<Field, number>>): number | undefined {
  const sample = rows.slice(0, 30);
  const width = Math.max(0, ...sample.map((r) => r.length));
  let best: number | undefined;
  let bestLength = 0;
  const takenSet = new Set(Object.values(taken));
  for (let col = 0; col < width; col++) {
    if (takenSet.has(col)) continue;
    const texts = sample.map((r) => r[col] ?? "").filter((c) => c && parseAmount(c) === null && !parseUkDate(c));
    const avg = texts.reduce((s, t) => s + t.length, 0) / Math.max(1, sample.length);
    if (avg > bestLength) { bestLength = avg; best = col; }
  }
  return best;
}

function guessFromContent(rows: string[][]): Omit<ColumnMapping, "signature"> | null {
  const sample = rows.slice(0, 30);
  if (sample.length === 0) return null;
  const width = Math.max(...sample.map((r) => r.length));
  const share = (col: number, test: (c: string) => boolean) =>
    sample.filter((r) => test(r[col] ?? "")).length / sample.length;

  const dateCol = [...Array(width).keys()].find((c) => share(c, (v) => parseUkDate(v) !== null) > 0.8);
  if (dateCol === undefined) return null;
  const numberCols = [...Array(width).keys()].filter(
    (c) => c !== dateCol && share(c, (v) => parseAmount(v) !== null) > 0.8,
  );
  if (numberCols.length === 0) return null;
  const description = guessDescriptionColumn(sample, { date: dateCol, amount: numberCols[0] });
  if (description === undefined) return null;
  // With two number columns, the second is usually the running balance.
  return { date: dateCol, description, amount: numberCols[0], balance: numberCols[1] };
}
