import { parseAmount, parseUkDate } from "../money";
import type { ParsedRow } from "../types";

// Reads OFX (also called "Microsoft Money" format) and QIF ("Quicken") statements,
// which many UK banks offer as downloads.

/** Read the value of an OFX tag in a block. Works for both old (unclosed tags) and XML-style OFX. */
function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return m?.[1].trim();
}

/** OFX dates look like 20261112 or 20261112120000[0:GMT]. */
function ofxDate(value: string | undefined): string | null {
  const m = value?.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? parseUkDate(`${m[1]}-${m[2]}-${m[3]}`) : null;
}

/** OFX amounts use a dot or (in some European exports) a comma for decimals. */
function ofxAmount(value: string | undefined): number | null {
  if (!value) return null;
  const v = value.trim().replace(/^\+/, "");
  const normal = /^-?\d+,\d{1,2}$/.test(v) ? v.replace(",", ".") : v;
  return parseAmount(normal);
}

export function parseOfx(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const date = ofxDate(tag(block, "DTPOSTED") ?? tag(block, "DTUSER"));
    const amount = ofxAmount(tag(block, "TRNAMT"));
    if (!date || amount === null || amount === 0) continue;
    const name = tag(block, "NAME") ?? "";
    const memo = tag(block, "MEMO") ?? "";
    const description = [name, memo && memo !== name ? memo : ""].filter(Boolean).join(" ").replace(/&amp;/g, "&").trim();
    rows.push({ date, description: description || "(no description)", amount });
  }
  return rows;
}

/** QIF dates: 12/11/2026, 12/11/26, 12-11-2026, or 12/11'26. UK banks put the day first. */
function qifDate(value: string): string | null {
  return parseUkDate(value.replace(/'\s*/, "/").replace(/\s+/g, ""));
}

export function parseQif(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let date: string | null = null;
  let amount: number | null = null;
  let payee = "";
  let memo = "";
  for (const line of text.split(/\r?\n/)) {
    const code = line[0];
    const value = line.slice(1).trim();
    if (code === "D") date = qifDate(value);
    else if (code === "T" || code === "U") amount = parseAmount(value);
    else if (code === "P") payee = value;
    else if (code === "M") memo = value;
    else if (code === "^") {
      if (date && amount !== null && amount !== 0) {
        const description = [payee, memo && memo !== payee ? memo : ""].filter(Boolean).join(" ");
        rows.push({ date, description: description || "(no description)", amount });
      }
      date = null; amount = null; payee = ""; memo = "";
    }
  }
  return rows;
}
