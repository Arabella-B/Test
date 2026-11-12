import { useEffect, useMemo, useRef, useState } from "react";
import Sheet from "../../components/Sheet";
import { getCategory } from "../categories";
import { CURRENCIES } from "../countries";
import { formatLocal, toPence } from "../fx";
import { formatDate, formatMoney, today } from "../money";
import { stopForDate } from "../route";
import { useTrip } from "../store";

// Add cash spending in two taps: type the amount, tap a category. Done.
// The currency is guessed from where your route says you are today.

const QUICK_CATEGORIES = [
  "eating_out", "groceries", "local_transport", "coffee", "activities", "going_out",
  "accommodation", "laundry", "health", "shopping", "gifts", "uncategorised",
];
const LAST_CURRENCY_KEY = "gap-year-last-currency";

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function done(message: string) {
    setOpen(false);
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-coral px-5 text-lg font-extrabold text-white shadow-lg active:scale-95 md:bottom-8"
        aria-label="Add cash spending"
      >
        <span className="text-2xl leading-none">+</span> Cash
      </button>
      {open && <QuickAddSheet onClose={() => setOpen(false)} onDone={done} />}
      {toast && (
        <div className="fixed inset-x-4 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-white shadow-lg md:bottom-28">
          {toast}
        </div>
      )}
    </>
  );
}

function QuickAddSheet({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const { stops, fx, addCash } = useTrip();
  const input = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(today());
  const here = stopForDate(date, stops);
  const [currency, setCurrency] = useState(() => {
    try { return here?.currency ?? localStorage.getItem(LAST_CURRENCY_KEY) ?? "GBP"; } catch { return here?.currency ?? "GBP"; }
  });
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const value = parseFloat(amount.replace(/,/g, ""));
  const pence = useMemo(() => {
    try { return value > 0 ? toPence(value, currency, fx) : 0; } catch { return 0; }
  }, [value, currency, fx]);

  async function save(categoryId: string) {
    if (!(value > 0)) {
      setError("Type the amount first.");
      input.current?.focus();
      return;
    }
    try { localStorage.setItem(LAST_CURRENCY_KEY, currency); } catch { /* ignore */ }
    const switchedOn = await addCash({ date, localAmount: value, currency, categoryId, note });
    const saved = `Saved ${formatLocal(value, currency)} (${formatMoney(pence)}) · ${getCategory(categoryId).name}`;
    onDone(switchedOn
      ? `${saved}. From now on, ATM withdrawals won't count as spending too, so nothing is counted twice.`
      : saved);
  }

  return (
    <Sheet onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">💵 Add cash spending</h2>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-cream" aria-label="Close">✕</button>
        </div>

        <div className="flex items-stretch gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="min-h-16 rounded-2xl border border-black/10 bg-cream px-3 text-lg font-bold"
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            ref={input}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount"
            className="min-h-16 w-0 min-w-0 flex-1 rounded-2xl border border-black/10 px-4 text-right text-3xl font-extrabold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <p className="-mt-2 text-right text-sm text-muted">
          {pence > 0 ? <>≈ <b className="text-ink">{formatMoney(pence)}</b></> : " "}
          {currency !== "GBP" && <> · rate from {formatDate(fx.date)}{fx.source === "built-in" ? " (offline backup)" : ""}</>}
        </p>

        <p className="text-sm font-semibold">Tap a category to save</p>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_CATEGORIES.map((id) => {
            const c = getCategory(id);
            return (
              <button key={id} onClick={() => save(id)}
                className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-[11px] font-semibold leading-tight active:scale-95"
                style={{ backgroundColor: c.colour + "22" }}>
                <span className="text-2xl">{c.emoji}</span>
                <span className="line-clamp-2">{c.name}</span>
              </button>
            );
          })}
        </div>
        {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}

        {more ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="label">Note
              <input className="input" maxLength={60} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pho stall" />
            </label>
            <label className="label">Date
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
        ) : (
          <button onClick={() => setMore(true)} className="text-sm font-semibold text-brand">+ Add a note or change the date</button>
        )}
        {here && <p className="text-center text-xs text-muted">{here.flag} You're in {here.country} on {formatDate(date)}, per your route.</p>}
        <p className="text-center text-[10px] text-muted">
          <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates by Exchange Rate API</a>
        </p>
      </div>
    </Sheet>
  );
}
