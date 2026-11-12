import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { dueDate, sortChecklist, urgency, type Urgency } from "../checklist";
import { daysBetween, formatDate, today } from "../money";
import { useTrip } from "../store";

// Pre-departure checklist, most urgent first, with due dates counted back
// from your departure date.

const STYLE: Record<Urgency, { dot: string; label: string; ring: string }> = {
  overdue: { dot: "bg-bad", label: "Do now", ring: "ring-bad/40" },
  soon: { dot: "bg-warn", label: "Soon", ring: "ring-warn/40" },
  upcoming: { dot: "bg-good", label: "Later", ring: "ring-ink/10" },
  done: { dot: "bg-muted", label: "Done", ring: "ring-ink/10" },
};

export default function Checklist() {
  const { checklist, saveChecklist, settings, hasSettings } = useTrip();
  const [open, setOpen] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDays, setNewDays] = useState("7");

  const departure = settings.departureDate;
  const daysToGo = daysBetween(today(), departure);
  const items = sortChecklist(checklist);
  const doneCount = checklist.filter((c) => c.done).length;

  function toggle(id: string) {
    void saveChecklist(checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    void saveChecklist([...checklist, {
      id: crypto.randomUUID(), title: newTitle.trim(), daysBefore: Math.max(0, parseInt(newDays) || 0), done: false, custom: true,
    }]);
    setNewTitle("");
  }

  function remove(id: string) {
    void saveChecklist(checklist.filter((c) => c.id !== id));
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-coral to-brand text-white">
        <div>
          <p className="text-sm font-semibold opacity-90">{hasSettings ? `Leaving ${formatDate(departure, "long")}` : "Set your departure date"}</p>
          <p className="text-3xl font-extrabold">
            {daysToGo > 0 ? `${daysToGo} days to go` : daysToGo === 0 ? "Today! 🎉" : "You're away ✈️"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold">{doneCount}/{checklist.length}</p>
          <p className="text-sm opacity-90">done</p>
        </div>
      </div>
      {!hasSettings && (
        <Link to="/trip/settings" className="rounded-2xl bg-sun/25 p-3 text-sm font-semibold">
          ⚙️ Set your departure date in Settings so due dates are right.
        </Link>
      )}

      <div className="grid grid-cols-1 gap-2">
        {items.map((item) => {
          const u = urgency(item, departure);
          const due = dueDate(item, departure);
          const s = STYLE[u];
          return (
            <div key={item.id} className={`rounded-3xl bg-surface ring-2 ${s.ring} ${item.done ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => toggle(item.id)}
                  aria-label={item.done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 text-lg font-bold ${item.done ? "border-good bg-good text-white" : "border-ink/25"}`}
                >
                  {item.done ? "✓" : ""}
                </button>
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === item.id ? null : item.id)}>
                  <span className={`block font-semibold ${item.done ? "line-through" : ""}`}>{item.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.dot}`} />
                    {s.label} · due {formatDate(due)}
                  </span>
                </button>
              </div>
              {open === item.id && (item.detail || item.custom) && (
                <div className="border-t border-ink/10 px-4 py-3 text-sm text-muted">
                  {item.detail}
                  {item.custom && <button onClick={() => remove(item.id)} className="mt-2 block font-semibold text-bad">Remove</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={add} className="card grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <label className="label">Add your own
          <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Buy a padlock" />
        </label>
        <label className="label">Days before
          <input className="input" type="number" min={0} value={newDays} onChange={(e) => setNewDays(e.target.value)} />
        </label>
        <button className="btn">Add</button>
      </form>
      <p className="text-xs text-muted">Visa, health and entry rules change. Always check gov.uk foreign travel advice and TravelHealthPro before you go.</p>
    </div>
  );
}
