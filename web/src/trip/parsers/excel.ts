// Reads Excel (.xlsx) bank statements by turning the first sheet into rows of
// text, then using the same column detection as CSV files.

type Cell = string | number | boolean | Date | null | undefined;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Turn one spreadsheet cell into text the CSV reader understands (dates as DD/MM/YYYY). */
export function cellToText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return "";
    // Excel dates have no time zone; read them as UTC so they don't shift by a day.
    return `${pad(cell.getUTCDate())}/${pad(cell.getUTCMonth() + 1)}/${cell.getUTCFullYear()}`;
  }
  if (typeof cell === "number") return String(Math.round(cell * 100) / 100);
  return String(cell).trim();
}

export function sheetToRows(sheet: Cell[][]): string[][] {
  return sheet.map((row) => row.map(cellToText));
}

/** Read the first sheet of an .xlsx file (browser only). */
export async function readExcelRows(file: File): Promise<string[][]> {
  const { readSheet } = await import("read-excel-file/browser");
  const data = await readSheet(file);
  return sheetToRows(data as Cell[][]);
}
