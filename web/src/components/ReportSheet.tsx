import { useState, type FormEvent } from "react";
import { REPORT_REASONS } from "../groups/types";
import Sheet from "./Sheet";

// The form for reporting a message or post. Reports go to the site owner.

export default function ReportSheet({
  what, preview, authorName, onClose, onSubmit,
}: { what: "message" | "post"; preview: string; authorName: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSubmit(details.trim() ? `${reason}: ${details.trim()}` : reason);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the report.");
    }
  }

  return (
    <Sheet onClose={onClose}>
      {done ? (
        <div className="text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 font-bold">Thanks for reporting</p>
          <p className="text-sm text-muted">The report has been sent. You can also block {authorName} so you don't see their messages.</p>
          <button className="btn mt-4 w-full" onClick={onClose}>Done</button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <p className="text-lg font-bold">Report this {what}</p>
          {preview && <p className="line-clamp-2 rounded-2xl bg-cream p-3 text-sm">{preview}</p>}
          <div className="grid gap-1.5">
            {REPORT_REASONS.map((r) => (
              <label key={r} className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 ${reason === r ? "bg-brand-soft" : ""}`}>
                <input type="radio" name="reason" className="h-5 w-5 accent-brand" checked={reason === r} onChange={() => setReason(r)} />
                <span className="text-sm font-semibold">{r}</span>
              </label>
            ))}
          </div>
          <textarea className="input min-h-20 py-3" maxLength={400} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything else? (optional)" />
          <p className="text-xs text-muted">If someone is in danger, contact local emergency services first.</p>
          {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
          <button className="btn">Send report</button>
        </form>
      )}
    </Sheet>
  );
}
