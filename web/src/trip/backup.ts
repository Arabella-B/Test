import { getCategory } from "./categories";
import type { TripData } from "./db";

// Backups: export everything to a file you keep, and import it again later
// (for example on a new phone, or after clearing Safari data).

export const BACKUP_VERSION = 1;

export function backupJson(data: TripData): string {
  return JSON.stringify({ app: "gap-year-hub", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...data }, null, 2);
}

export function parseBackup(text: string): TripData {
  const parsed = JSON.parse(text);
  if (parsed?.app !== "gap-year-hub" || !Array.isArray(parsed.transactions)) {
    throw new Error("This file isn't a Gap Year Hub backup.");
  }
  return {
    transactions: parsed.transactions,
    settings: parsed.settings ?? null,
    checklist: parsed.checklist ?? null,
    rules: parsed.rules ?? [],
    mappings: parsed.mappings ?? [],
    stops: parsed.stops ?? [],
    budgets: parsed.budgets ?? [],
  };
}

/** A spreadsheet-friendly CSV of all transactions. */
export function transactionsCsv(data: TripData): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ["Date,Description,Merchant,Category,Amount (GBP),Balance (GBP),Local amount,Currency"];
  for (const t of [...data.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    lines.push([
      t.date,
      escape(t.description),
      escape(t.merchant),
      escape(getCategory(t.categoryId).name),
      (t.amount / 100).toFixed(2),
      t.balance !== undefined ? (t.balance / 100).toFixed(2) : "",
      t.localAmount !== undefined ? String(t.localAmount) : "",
      t.currency ?? "",
    ].join(","));
  }
  return lines.join("\n");
}

/** Save text as a file on the device (opens the Files/Downloads save). */
export function downloadFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
