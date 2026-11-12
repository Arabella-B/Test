import { categorise, merchantName, normalise } from "./categorise";
import type { MerchantRule, ParsedRow, Transaction } from "./types";

// Turns rows read from a statement into categorised transactions, and skips
// any that are already saved (statements often overlap by a few days).

/**
 * A key that identifies a transaction across overlapping statements.
 * Two identical coffees on the same day are told apart by counting them
 * (…|1, …|2), so real repeats are kept but re-imports are skipped.
 */
export function dedupeKeys(rows: ParsedRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${r.date}|${r.amount}|${normalise(r.description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}|${n}`;
  });
}

export interface ImportSummary {
  added: Transaction[];
  duplicates: number;
  needsChecking: number;
}

export function buildImport(
  rows: ParsedRow[],
  existingKeys: Set<string>,
  options: { rules: MerchantRule[]; familySenders: string[]; source: Transaction["source"]; importId: string },
): ImportSummary {
  const keys = dedupeKeys(rows);
  const added: Transaction[] = [];
  let duplicates = 0;
  rows.forEach((row, i) => {
    if (existingKeys.has(keys[i])) { duplicates++; return; }
    existingKeys.add(keys[i]);
    const result = categorise(row.description, row.amount, options);
    added.push({
      id: crypto.randomUUID(),
      date: row.date,
      description: row.description,
      merchant: merchantName(row.description),
      amount: row.amount,
      balance: row.balance,
      categoryId: result.categoryId,
      categorySource: result.source,
      isForeign: result.isForeign,
      source: options.source,
      importId: options.importId,
      dedupeKey: keys[i],
    });
  });
  return { added, duplicates, needsChecking: added.filter((t) => t.categorySource === "unsure").length };
}
