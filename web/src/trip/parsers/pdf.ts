import { parseAmount, parseUkDate } from "../money";
import type { ParsedRow } from "../types";

// Reads PDF bank statements.
//
// A PDF doesn't contain a table, only bits of text at x/y positions. So we:
//  1. group the text into lines (same y position),
//  2. join nearby words into phrases ("Paid" + "out" → "Paid out"),
//  3. find the header line to learn where each column sits,
//  4. read each line: a date (if shown), description text, and amounts, which
//     we place in a column by lining them up with the header.
// UK banks often show the date only once per day and split descriptions over
// several lines, so the last date is remembered and description lines without
// an amount are joined onto the next transaction.

export interface PdfWord {
  x: number; // left edge
  width: number;
  str: string;
}

export interface PdfLine {
  y: number;
  words: PdfWord[];
}

interface Phrase {
  x: number;
  right: number;
  text: string;
}

type AmountColumn = "paidOut" | "paidIn" | "amount" | "balance";

interface Layout {
  dateRight: number;
  descriptionX: number;
  columns: { name: AmountColumn; right: number }[];
}

const SKIP_LINE = /balance (brought|carried) forward|(start|end|opening|closing) balance|^total|page \d+ of|continued/i;

/** Join words on a line that are close together into phrases. */
export function toPhrases(words: PdfWord[]): Phrase[] {
  const sorted = [...words].filter((w) => w.str.trim()).sort((a, b) => a.x - b.x);
  const phrases: Phrase[] = [];
  for (const w of sorted) {
    const last = phrases[phrases.length - 1];
    if (last && w.x - last.right < 5) {
      last.text += (w.x - last.right > 0.5 ? " " : "") + w.str.trim();
      last.right = w.x + w.width;
    } else {
      phrases.push({ x: w.x, right: w.x + w.width, text: w.str.trim() });
    }
  }
  return phrases;
}

/** Look for the header line ("Date … Paid out … Paid in … Balance") and record where columns are. */
export function findLayout(phrases: Phrase[]): Layout | null {
  const lower = phrases.map((p) => p.text.toLowerCase());
  const dateIndex = lower.findIndex((t) => t === "date" || t.startsWith("date"));
  if (dateIndex < 0) return null;
  const columns: Layout["columns"] = [];
  phrases.forEach((p, i) => {
    const t = lower[i];
    if (/^(paid out|money out|payments?( out)?|withdrawn|withdrawals?|debits?|out)( £)?$/.test(t)) columns.push({ name: "paidOut", right: p.right });
    else if (/^(paid in|money in|receipts?|deposits?|credits?|in)( £)?$/.test(t)) columns.push({ name: "paidIn", right: p.right });
    else if (/^(amount|value)( £)?$/.test(t)) columns.push({ name: "amount", right: p.right });
    else if (/^balance( £)?$/.test(t)) columns.push({ name: "balance", right: p.right });
  });
  const hasMoney = columns.some((c) => c.name !== "balance");
  if (!hasMoney) return null;
  const description = phrases.find((_, i) => i !== dateIndex && /description|details|transaction|payment type/.test(lower[i]));
  return {
    dateRight: phrases[dateIndex].right,
    descriptionX: description?.x ?? phrases[dateIndex].right + 5,
    columns,
  };
}

/** Find the year printed on the statement (e.g. "1 November 2026"), for dates shown without one. */
export function findStatementYear(pages: PdfLine[][]): number | undefined {
  for (const line of pages[0] ?? []) {
    const m = line.words.map((w) => w.str).join(" ").match(/\b(20\d{2})\b/);
    if (m) return +m[1];
  }
  return undefined;
}

export interface PdfParseResult {
  rows: ParsedRow[];
  scanned: boolean; // true if the PDF has no text (a scanned picture)
  foundTable: boolean;
}

export function parsePdfLines(pages: PdfLine[][], fallbackYear = new Date().getFullYear()): PdfParseResult {
  const wordCount = pages.reduce((n, p) => n + p.reduce((m, l) => m + l.words.length, 0), 0);
  if (wordCount < 5) return { rows: [], scanned: true, foundTable: false };

  let year = findStatementYear(pages) ?? fallbackYear;
  let lastMonth = 0;
  const rows: ParsedRow[] = [];
  let layout: Layout | null = null;
  let currentDate: string | null = null;
  let pendingText: string[] = [];
  let lastBalance: number | undefined;
  let foundTable = false;

  for (const page of pages) {
    pendingText = [];
    for (const line of page) {
      const phrases = toPhrases(line.words);
      if (phrases.length === 0) continue;

      const header = findLayout(phrases);
      if (header) { layout = header; foundTable = true; pendingText = []; continue; }

      const fullText = phrases.map((p) => p.text).join(" ");

      // A date at the start of the line (sometimes split, e.g. "12 Nov" "26").
      let date: string | null = null;
      let rest = phrases;
      for (const take of [2, 1]) {
        if (phrases.length < take) continue;
        const candidate = phrases.slice(0, take).map((p) => p.text).join(" ");
        const parsed = parseUkDate(candidate, year);
        if (parsed) { date = parsed; rest = phrases.slice(take); break; }
      }
      if (!date) {
        // The date may be stuck to the description in one phrase: "12 Nov 26 TESCO".
        const m = phrases[0].text.match(/^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2} [A-Za-z]{3}(?: \d{4}| \d{2}(?= ))?)\s+(.+)$/);
        const parsed = m ? parseUkDate(m[1], year) : null;
        if (m && parsed) {
          date = parsed;
          rest = [{ ...phrases[0], text: m[2] }, ...phrases.slice(1)];
        }
      }
      if (date) {
        // Dates without a year roll into the next year after December.
        const month = +date.slice(5, 7);
        if (lastMonth === 12 && month === 1 && !/\d{4}/.test(fullText.slice(0, 12))) {
          year += 1;
          date = `${year}${date.slice(4)}`;
        }
        lastMonth = month;
        currentDate = date;
      }

      if (SKIP_LINE.test(fullText)) {
        const amounts = rest.map((p) => parseAmount(p.text)).filter((a): a is number => a !== null);
        if (amounts.length) lastBalance = amounts[amounts.length - 1];
        pendingText = [];
        continue;
      }

      // Split the rest into amounts (right-hand side) and description text.
      const amountPhrases: Phrase[] = [];
      const textPhrases: Phrase[] = [];
      const firstMoneyColumn = layout ? Math.min(...layout.columns.map((c) => c.right)) - 90 : Infinity;
      for (const p of rest) {
        const isAmount = parseAmount(p.text) !== null && /\d\.\d{2}/.test(p.text);
        if (isAmount && (!layout || p.right > firstMoneyColumn)) amountPhrases.push(p);
        else textPhrases.push(p);
      }
      const description = textPhrases.map((p) => p.text).join(" ").trim();

      if (amountPhrases.length === 0) {
        // A description line with no amount: keep it for the next transaction.
        // Skip lines that are only a reference or a date, which add nothing.
        if (description && currentDate && !/^(on )?\d{1,2} [a-z]{3}/i.test(description)) pendingText.push(description);
        continue;
      }
      if (!currentDate) continue;

      let amount: number | null = null;
      let balance: number | undefined;
      if (layout) {
        for (const p of amountPhrases) {
          const value = parseAmount(p.text)!;
          const column = nearestColumn(layout, p.right);
          if (column === "balance") balance = value;
          else if (column === "paidOut") amount = -Math.abs(value);
          else if (column === "paidIn") amount = Math.abs(value);
          else amount = value;
        }
      } else {
        // No header found: last number is the balance if there are two.
        // Without column headings we can't tell money in from money out, so assume
        // money out unless marked CR or +; the balance check below corrects it.
        const signed = (p: Phrase) => {
          const value = Math.abs(parseAmount(p.text)!);
          return /CR\b|^\+/i.test(p.text) ? value : -value;
        };
        if (amountPhrases.length >= 2) {
          balance = parseAmount(amountPhrases[amountPhrases.length - 1].text)!;
          amount = signed(amountPhrases[amountPhrases.length - 2]);
        } else amount = signed(amountPhrases[0]);
      }
      if (amount === null) { if (balance !== undefined) lastBalance = balance; continue; }

      // If the statement shows balances, use the change in balance to get the sign right.
      if (balance !== undefined && lastBalance !== undefined) {
        const change = balance - lastBalance;
        if (Math.abs(Math.abs(change) - Math.abs(amount)) <= 1) amount = change;
      }
      if (balance !== undefined) lastBalance = balance;

      const fullDescription = [...pendingText, description].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      pendingText = [];
      rows.push({ date: currentDate, description: fullDescription || "(no description)", amount, balance });
    }
  }
  return { rows, scanned: false, foundTable };
}

function nearestColumn(layout: Layout, right: number): AmountColumn {
  let best = layout.columns[0];
  for (const c of layout.columns) {
    if (Math.abs(c.right - right) < Math.abs(best.right - right)) best = c;
  }
  return best.name;
}

/** Use pdf.js (in the browser) to pull positioned text out of a PDF file. */
export async function extractPdfLines(data: ArrayBuffer): Promise<PdfLine[][]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfLine[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const lines: PdfLine[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      // Words within 3 points vertically are on the same line.
      let line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (!line) { line = { y, words: [] }; lines.push(line); }
      line.words.push({ x, width: item.width, str: item.str });
    }
    lines.sort((a, b) => b.y - a.y); // PDF y goes up the page, so read top to bottom
    pages.push(lines);
  }
  return pages;
}
