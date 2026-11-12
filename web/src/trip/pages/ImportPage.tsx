import { useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { type ImportSummary } from "../importer";
import { applyMapping, parseCsvStatement } from "../parsers/csv";
import { extractPdfLines, parsePdfLines } from "../parsers/pdf";
import { useTrip } from "../store";
import type { ColumnMapping } from "../types";

// Drag-and-drop (or choose) a bank statement. Everything is read here in the
// browser; the file is never uploaded anywhere.

type State =
  | { step: "idle" }
  | { step: "reading"; name: string }
  | { step: "mapping"; name: string; header: string[]; dataRows: string[][]; signature: string }
  | { step: "done"; name: string; summary: ImportSummary; skipped: number }
  | { step: "error"; name: string; message: string };

export default function ImportPage() {
  const { importRows, mappings, saveMapping } = useTrip();
  const [state, setState] = useState<State>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState({ step: "reading", name: file.name });
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".pdf") || file.type === "application/pdf") {
        const pages = await extractPdfLines(await file.arrayBuffer());
        const result = parsePdfLines(pages);
        if (result.scanned) {
          return setState({
            step: "error", name: file.name,
            message: "This PDF looks like a scanned picture, so there's no text to read. Please download a CSV statement from your bank instead (look for \"Export\" or \"Download transactions\").",
          });
        }
        if (result.rows.length === 0) {
          return setState({
            step: "error", name: file.name,
            message: "No transactions were found in this PDF. Its layout may be unusual; a CSV download from your bank will work best.",
          });
        }
        const summary = await importRows(result.rows, "pdf");
        return setState({ step: "done", name: file.name, summary, skipped: 0 });
      }
      if (lower.endsWith(".csv") || lower.endsWith(".txt") || file.type.includes("csv") || file.type.startsWith("text/")) {
        const result = parseCsvStatement(await file.text(), mappings);
        if (result.ok) {
          const summary = await importRows(result.rows, "csv");
          return setState({ step: "done", name: file.name, summary, skipped: result.skipped });
        }
        if (result.reason === "needs-mapping") {
          return setState({ step: "mapping", name: file.name, header: result.header, dataRows: result.dataRows, signature: result.signature });
        }
        return setState({ step: "error", name: file.name, message: "This file is empty." });
      }
      if (/\.(xlsx|xls|ofx|qif)$/.test(lower)) {
        return setState({ step: "error", name: file.name, message: "Excel, OFX and QIF files are coming in a later stage. For now, please use CSV or PDF." });
      }
      setState({ step: "error", name: file.name, message: "Please choose a CSV or PDF bank statement." });
    } catch (err) {
      console.error(err);
      setState({ step: "error", name: file.name, message: "Something went wrong reading this file. Try a CSV download from your bank." });
    }
  }

  async function finishMapping(mapping: Omit<ColumnMapping, "signature">) {
    if (state.step !== "mapping") return;
    await saveMapping({ ...mapping, signature: state.signature });
    const { rows, skipped } = applyMapping(state.dataRows, mapping);
    const summary = await importRows(rows, "csv");
    setState({ step: "done", name: state.name, summary, skipped });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`grid place-items-center gap-4 rounded-3xl border-4 border-dashed p-8 text-center transition md:p-14 ${
          dragging ? "border-brand bg-brand-soft" : "border-brand/30 bg-white"
        }`}
      >
        <div className="text-6xl">📄</div>
        <div>
          <p className="text-xl font-extrabold">Drop your bank statement here</p>
          <p className="mt-1 text-muted">CSV or PDF · read on this device, never uploaded</p>
        </div>
        <button className="btn" onClick={() => input.current?.click()}>📂 Choose file</button>
        <input
          ref={input}
          type="file"
          accept=".csv,.pdf,.txt,text/csv,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
        />
      </div>

      {state.step === "reading" && <div className="card text-center font-semibold">Reading {state.name}…</div>}

      {state.step === "error" && (
        <div className="card border-l-8 border-bad">
          <p className="font-bold">Couldn't import {state.name}</p>
          <p className="mt-1 text-muted">{state.message}</p>
        </div>
      )}

      {state.step === "done" && (
        <div className="card grid gap-3">
          <p className="text-lg font-extrabold">🎉 {state.name} imported</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat emoji="✅" value={state.summary.added.length} label="transactions imported" tone="good" />
            <Stat emoji="⚠️" value={state.summary.needsChecking} label="need checking" tone={state.summary.needsChecking ? "warn" : "good"} />
            <Stat emoji="⏭️" value={state.summary.duplicates} label="duplicates skipped" tone="info" />
          </div>
          {state.skipped > 0 && <p className="text-sm text-muted">{state.skipped} rows that weren't transactions (like balance lines) were ignored.</p>}
          <div className="flex flex-wrap gap-2">
            {state.summary.needsChecking > 0 && <Link to="/trip/transactions?filter=check" className="btn">Review the unsure ones</Link>}
            <Link to="/trip" className="btn-soft">See dashboard</Link>
          </div>
        </div>
      )}

      {state.step === "mapping" && (
        <ColumnMatcher header={state.header} sample={state.dataRows.slice(0, 3)} onDone={finishMapping} onCancel={() => setState({ step: "idle" })} />
      )}

      <div className="card grid gap-2 text-sm text-muted">
        <p className="font-bold text-ink">Tips</p>
        <p>• In your banking app or website, look for <b>Statements</b> or <b>Download transactions</b>. CSV is the most reliable; PDF works too.</p>
        <p>• It's fine if statements overlap: transactions already imported are skipped.</p>
        <p>• On iPhone, "Choose file" opens the Files app. Save the statement there first.</p>
      </div>
    </div>
  );
}

function Stat({ emoji, value, label, tone }: { emoji: string; value: number; label: string; tone: "good" | "warn" | "info" }) {
  const bg = tone === "good" ? "bg-good/10" : tone === "warn" ? "bg-sun/20" : "bg-brand-soft";
  return (
    <div className={`rounded-2xl p-3 ${bg}`}>
      <div className="text-2xl font-extrabold">{emoji} {value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

/** Shown when columns can't be detected: pick which column is which. Remembered for next time. */
function ColumnMatcher({
  header, sample, onDone, onCancel,
}: { header: string[]; sample: string[][]; onDone: (m: Omit<ColumnMapping, "signature">) => void; onCancel: () => void }) {
  const [date, setDate] = useState(0);
  const [description, setDescription] = useState(Math.min(1, header.length - 1));
  const [style, setStyle] = useState<"single" | "split">("single");
  const [amount, setAmount] = useState(Math.min(2, header.length - 1));
  const [paidOut, setPaidOut] = useState(Math.min(2, header.length - 1));
  const [paidIn, setPaidIn] = useState(Math.min(3, header.length - 1));
  const [balance, setBalance] = useState(-1);

  const select = (value: number, set: (n: number) => void, optional = false) => (
    <select className="input" value={value} onChange={(e) => set(+e.target.value)}>
      {optional && <option value={-1}>(none)</option>}
      {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}{sample[0]?.[i] ? `: e.g. ${sample[0][i]}` : ""}</option>)}
    </select>
  );

  return (
    <div className="card grid gap-4">
      <div>
        <p className="text-lg font-extrabold">Help me read this file</p>
        <p className="text-sm text-muted">I couldn't tell which column is which. Match them once and I'll remember for next time.</p>
      </div>
      <label className="label">Date column {select(date, setDate)}</label>
      <label className="label">Description column {select(description, setDescription)}</label>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-cream p-1">
        <button onClick={() => setStyle("single")} className={`min-h-11 rounded-xl text-sm font-semibold ${style === "single" ? "bg-white shadow-sm" : ""}`}>One amount column</button>
        <button onClick={() => setStyle("split")} className={`min-h-11 rounded-xl text-sm font-semibold ${style === "split" ? "bg-white shadow-sm" : ""}`}>Paid out + Paid in</button>
      </div>
      {style === "single" ? (
        <label className="label">Amount column {select(amount, setAmount)}</label>
      ) : (
        <>
          <label className="label">Paid out column {select(paidOut, setPaidOut)}</label>
          <label className="label">Paid in column {select(paidIn, setPaidIn)}</label>
        </>
      )}
      <label className="label">Balance column (optional) {select(balance, setBalance, true)}</label>
      <div className="flex gap-2">
        <button
          className="btn"
          onClick={() => onDone({
            date, description,
            ...(style === "single" ? { amount } : { paidOut, paidIn }),
            ...(balance >= 0 ? { balance } : {}),
          })}
        >
          Import
        </button>
        <button className="btn-soft" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
