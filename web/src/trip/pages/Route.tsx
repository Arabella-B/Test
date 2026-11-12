import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import Sheet from "../../components/Sheet";
import Stamp from "../../components/Stamp";
import { COUNTRY_LIST, findCountry } from "../countries";
import { dailyTotal, getCard } from "../countryInfo";
import { formatLocal, fromPence } from "../fx";
import { addDays, daysBetween, formatDate, formatMoney, today } from "../money";
import { countableTransactions, followOrder, moveItem, remainingRoutePlan, routeWarnings, stopDays, stopStats, type StopStats } from "../route";
import { computeStats } from "../stats";
import { useTrip } from "../store";
import type { TripStop } from "../types";

// Your route: the countries you'll visit, with dates and a daily budget for each.
// Drag the ≡ handle (or use ▲ ▼) to change the order.

const DOT = { good: "bg-good", close: "bg-warn", over: "bg-bad", upcoming: "bg-ink/20" };
const LABEL = { good: "On budget", close: "Slightly over", over: "Over budget", upcoming: "Not started" };

export default function RoutePage() {
  const { stops, saveStops, transactions, settings, fx } = useTrip();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<TripStop | "new" | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [order, setOrder] = useState<TripStop[] | null>(null); // live order while dragging
  const listRef = useRef<HTMLDivElement>(null);

  const shown = order ?? stops;
  const countable = useMemo(() => countableTransactions(transactions, settings), [transactions, settings]);
  const statsById = useMemo(() => new Map(stops.map((s) => [s.id, stopStats(s, countable)])), [stops, countable]);
  const overall = useMemo(() => computeStats(transactions, settings), [transactions, settings]);

  // Money still needed for the rest of the route vs money you have left.
  const now = today();
  const stillPlanned = remainingRoutePlan(stops, countable, now);
  const available = overall.moneyLeft + overall.runway.futureFamily;
  const totalPlanned = stops.reduce((sum, s) => sum + s.dailyBudget * stopDays(s), 0);
  const warnings = routeWarnings(stops);

  // ---- drag to reorder (works with mouse and touch) ----
  function startDrag(e: PointerEvent, index: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(index);
    setOrder(stops);
  }
  function moveDrag(e: PointerEvent) {
    if (dragging === null || !order || !listRef.current) return;
    const items = [...listRef.current.querySelectorAll<HTMLElement>("[data-stop]")];
    let target = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (target === -1) target = items.length - 1;
    else if (target > dragging) target -= 1;
    if (target !== dragging) {
      setOrder(moveItem(order, dragging, target));
      setDragging(target);
    }
  }
  function endDrag() {
    if (order) void saveStops(order);
    setDragging(null);
    setOrder(null);
  }
  function nudge(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= stops.length) return;
    void saveStops(moveItem(stops, index, to));
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="card grid gap-2 bg-gradient-to-br from-sky-500 to-brand text-on-brand">
        <p className="text-sm font-semibold opacity-90">
          {stops.length ? `${stops.length} countr${stops.length === 1 ? "y" : "ies"} · planned ${formatMoney(totalPlanned, true)}` : "Plan your route"}
        </p>
        {stops.length > 0 && (
          <>
            <p className="text-2xl font-extrabold">
              {stillPlanned <= available
                ? `✅ Fits your money, with ${formatMoney(available - stillPlanned, true)} spare`
                : `⚠️ ${formatMoney(stillPlanned - available, true)} more than you have`}
            </p>
            <p className="text-xs opacity-90">
              Still to spend on the route: {formatMoney(stillPlanned, true)} · money left including family support: {formatMoney(available, true)}
            </p>
          </>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-3xl bg-sun/25 p-4 text-sm">
          {warnings.map((w) => <p key={w}>⚠️ {w}</p>)}
          <button
            onClick={() => {
              if (confirm("Change the dates so countries follow the order shown, back to back? Each country keeps its length.")) void saveStops(followOrder(stops));
            }}
            className="btn-soft mt-3 min-h-10 w-full text-sm"
          >
            📅 Fix dates to follow this order
          </button>
        </div>
      )}

      {stops.length === 0 ? (
        <div className="card text-center">
          <p className="text-4xl">🗺️</p>
          <p className="mt-2 font-bold">No countries yet</p>
          <p className="text-sm text-muted">Add each country with dates and a daily budget. Your spending is matched to countries by date.</p>
        </div>
      ) : (
        <section className="card card-sun">
          <h2 className="mb-1 text-lg font-extrabold">🛂 Your passport</h2>
          <p className="mb-4 text-sm text-muted">A stamp for every country you've reached. Faded ones are still to come.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-6 py-2">
            {stops.map((s, i) => (
              <Stamp key={s.id} index={i} title={s.country} icon={s.flag}
                subtitle={formatDate(s.startDate)} faded={s.startDate > now} />
            ))}
          </div>
        </section>
      )}

      {stops.length > 0 && (
        <div ref={listRef} className="pop-in grid gap-3" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {shown.map((s, i) => (
            <StopCard
              key={s.id}
              stop={s}
              stats={statsById.get(s.id) ?? stopStats(s, countable)}
              localDaily={formatLocal(fromPence(s.dailyBudget, s.currency, fx), s.currency)}
              dragging={dragging === i}
              onHandleDown={(e) => startDrag(e, i)}
              onUp={() => nudge(i, -1)}
              onDown={() => nudge(i, 1)}
              isFirst={i === 0}
              isLast={i === shown.length - 1}
              onEdit={() => setEditing(s)}
              onShowSpending={() => navigate(`/trip/transactions?from=${s.startDate}&to=${s.endDate}`)}
            />
          ))}
        </div>
      )}

      <button className="btn" onClick={() => setEditing("new")}>+ Add a country</button>

      {editing && (
        <StopSheet
          stop={editing === "new" ? null : editing}
          previous={stops[stops.length - 1]}
          departure={settings.departureDate}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            const exists = stops.some((x) => x.id === s.id);
            void saveStops(exists ? stops.map((x) => (x.id === s.id ? s : x)) : [...stops, s]);
            setEditing(null);
          }}
          onDelete={(id) => {
            void saveStops(stops.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StopCard(props: {
  stop: TripStop; stats: StopStats; localDaily: string; dragging: boolean; isFirst: boolean; isLast: boolean;
  onHandleDown: (e: PointerEvent) => void; onUp: () => void; onDown: () => void; onEdit: () => void; onShowSpending: () => void;
}) {
  const { stop, stats, dragging } = props;
  const pct = stats.actualDaily !== null && stop.dailyBudget > 0 ? stats.actualDaily / stop.dailyBudget : 0;
  return (
    <div data-stop className={`rounded-3xl bg-surface ring-1 ring-ink/10 transition ${dragging ? "scale-[1.02] shadow-lg ring-brand-strong" : "shadow-sm"}`}>
      <div className="flex items-stretch">
        <button
          onPointerDown={props.onHandleDown}
          className="grid w-11 shrink-0 cursor-grab touch-none place-items-center rounded-l-3xl text-xl text-muted active:cursor-grabbing"
          aria-label={`Drag to reorder ${stop.country}`}
        >
          ≡
        </button>
        <button onClick={props.onEdit} className="min-w-0 flex-1 py-4 pr-2 text-left">
          <span className="flex items-center gap-2">
            <span className="text-2xl">{stop.flag}</span>
            <span className="truncate text-lg font-extrabold">{stop.country}</span>
            <span className={`ml-auto h-3 w-3 shrink-0 rounded-full ${DOT[stats.status]}`} title={LABEL[stats.status]} />
          </span>
          <span className="block text-sm text-muted">
            {formatDate(stop.startDate)} – {formatDate(stop.endDate, "long")} · {stats.days} day{stats.days === 1 ? "" : "s"}
          </span>
          <span className="mt-1 block text-sm">
            Target <b>{formatMoney(stop.dailyBudget, true)}/day</b> <span className="text-muted">≈ {props.localDaily}</span>
          </span>
          {stats.actualDaily !== null && (
            <span className="mt-2 block">
              <span className="flex justify-between text-xs font-semibold">
                <span>Spent {formatMoney(stats.actualDaily, true)}/day so far</span>
                <span className={stats.status === "over" ? "text-bad" : stats.status === "close" ? "text-warn" : "text-good"}>{LABEL[stats.status]}</span>
              </span>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-ink/10">
                <span className={`block h-full rounded-full ${DOT[stats.status]}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
              </span>
              {stats.daysLeft > 0 && stats.aimDaily !== null && (
                <span className="mt-1 block text-xs text-muted">{stats.daysLeft} days left · aim for {formatMoney(stats.aimDaily, true)}/day to finish on budget</span>
              )}
            </span>
          )}
        </button>
        <div className="flex flex-col justify-center gap-1 pr-2">
          <button onClick={props.onUp} disabled={props.isFirst} className="grid h-9 w-9 place-items-center rounded-full bg-cream text-sm disabled:opacity-30" aria-label={`Move ${stop.country} up`}>▲</button>
          <button onClick={props.onDown} disabled={props.isLast} className="grid h-9 w-9 place-items-center rounded-full bg-cream text-sm disabled:opacity-30" aria-label={`Move ${stop.country} down`}>▼</button>
        </div>
      </div>
      {stats.daysElapsed > 0 && (
        <button onClick={props.onShowSpending} className="block w-full border-t border-ink/10 py-2 text-center text-xs font-semibold text-brand-strong">
          See spending in {stop.country} →
        </button>
      )}
    </div>
  );
}

function StopSheet({ stop, previous, departure, onClose, onSave, onDelete }: {
  stop: TripStop | null; previous?: TripStop; departure: string;
  onClose: () => void; onSave: (s: TripStop) => void; onDelete: (id: string) => void;
}) {
  const { fx, cardEdits } = useTrip();
  const defaultStart = stop?.startDate ?? (previous ? addDays(previous.endDate, 1) : departure || today());
  const [country, setCountry] = useState(stop?.country ?? "");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(stop?.endDate ?? addDays(defaultStart, 13));
  const [daily, setDaily] = useState(stop ? String(stop.dailyBudget / 100) : "");
  const [error, setError] = useState<string | null>(null);

  const info = findCountry(country);
  const dailyPence = Math.round((parseFloat(daily) || 0) * 100);
  const days = start && end && end >= start ? daysBetween(start, end) + 1 : 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!info) return setError("Choose a country.");
    if (!start || !end || end < start) return setError("Check the dates: the last day must be on or after the first day.");
    if (dailyPence <= 0) return setError("Add a daily budget in pounds.");
    onSave({
      id: stop?.id ?? crypto.randomUUID(), country: info.name, flag: info.flag, currency: info.currency,
      startDate: start, endDate: end, dailyBudget: dailyPence,
    });
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4">
        <h2 className="text-xl font-extrabold">{stop ? `Edit ${stop.country}` : "Add a country"}</h2>
        <label className="label">Country
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Choose…</option>
            {COUNTRY_LIST.map((c) => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">First day
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="label">Last day
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {(() => {
          const card = info && getCard(info.name, cardEdits);
          if (!card) return null;
          return (
            <div className="rounded-2xl bg-cream p-3 text-sm">
              <p className="font-semibold">Typical daily costs in {card.country}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDaily(String(dailyTotal(card, "budget")))} className="rounded-xl bg-surface px-3 py-2 font-semibold ring-1 ring-ink/10">
                  🎒 Backpacker £{dailyTotal(card, "budget")}
                </button>
                <button type="button" onClick={() => setDaily(String(dailyTotal(card, "midRange")))} className="rounded-xl bg-surface px-3 py-2 font-semibold ring-1 ring-ink/10">
                  🏨 Mid-range £{dailyTotal(card, "midRange")}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">Tap one to use it, or type your own below.</p>
            </div>
          );
        })()}
        <label className="label">Daily budget (£)
          <input className="input" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="e.g. 35" />
          {info && dailyPence > 0 && (
            <span className="text-xs font-normal text-muted">
              ≈ {formatLocal(fromPence(dailyPence, info.currency, fx), info.currency)} a day
              {days > 0 && <> · {formatMoney(dailyPence * days, true)} for {days} days</>}
            </span>
          )}
        </label>
        {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
        <button className="btn">{stop ? "Save" : "Add to route"}</button>
        {stop && (
          <button type="button" onClick={() => onDelete(stop.id)} className="min-h-12 rounded-2xl font-semibold text-bad ring-1 ring-bad/30">
            Remove {stop.country}
          </button>
        )}
      </form>
    </Sheet>
  );
}
