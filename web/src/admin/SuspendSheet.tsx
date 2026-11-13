import { useState, type FormEvent } from "react";
import Sheet from "../components/Sheet";
import { suspend } from "./adminApi";

// Admin pop-up: suspend someone, with a reason and an option to remove everything they've posted.

export default function SuspendSheet({ userId, name, onClose, onDone }: {
  userId: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [removeEverything, setRemoveEverything] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await suspend(userId, reason, removeEverything);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't suspend.");
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <h2 className="text-lg font-bold">🛡️ Suspend {name}?</h2>
        <p className="text-sm text-muted">
          They'll still be able to log in and use My Trip, but won't be able to post, message, like, report or join groups.
          You can lift it any time from the Admin page.
        </p>
        <label className="label">Reason (only admins see this)
          <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scam event, harassment" />
        </label>
        <label className="flex items-start gap-3 rounded-2xl bg-cream p-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={removeEverything} onChange={(e) => setRemoveEverything(e.target.checked)} />
          <span><b>Also remove everything they've posted</b><br />All their Discover posts and group chat messages. This can't be undone.</span>
        </label>
        {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
        <button className="min-h-12 rounded-2xl bg-bad font-semibold text-white" disabled={busy}>{busy ? "Suspending…" : `Suspend ${name}`}</button>
        <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
      </form>
    </Sheet>
  );
}
