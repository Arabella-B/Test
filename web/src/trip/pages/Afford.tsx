import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { findCountry } from "../countries";
import { allCards, dailyTotal, getCard, type CostStyle } from "../countryInfo";
import { addDays, formatMoney, today } from "../money";
import { countableTransactions, remainingRoutePlan } from "../route";
import { computeStats } from "../stats";
import { useTrip } from "../store";

// "Can I afford it?" Pick a country, how long, and how you'll travel, and see
// the estimated cost against the money you'd have spare after your route plan.

type Style = CostStyle | "custom";

export default function Afford() {
  const { transactions, settings, stops, saveStops, cardEdits } = useTrip();
  const navigate = useNavigate();
  const cards = useMemo(() => allCards(cardEdits), [cardEdits]);
  const [country, setCountry] = useState(cards[0]?.country ?? "");
  const [days, setDays] = useState("14");
  const [style, setStyle] = useState<Style>("budget");
  const [custom, setCustom] = useState("");

  const card = getCard(country, cardEdits);
  const nDays = Math.max(0, Math.min(365, parseInt(days) || 0));
  const daily = style === "custom" ? Math.max(0, parseFloat(custom) || 0) : card ? dailyTotal(card, style) : 0;
  const estimate = Math.round(daily * nDays * 100); // pence

  const stats = useMemo(() => computeStats(transactions, settings), [transactions, settings]);
  const available = stats.moneyLeft + stats.runway.futureFamily;
  const planned = useMemo(() => remainingRoutePlan(stops, countableTransactions(transactions, settings)), [stops, transactions, settings]);
  const spare = available - planned;
  const affordableDays = daily > 0 ? Math.max(0, Math.floor(spare / (daily * 100))) : 0;

  const verdict = estimate <= 0 ? null
    : estimate <= spare ? "yes"
    : estimate <= available ? "tight"
    : "no";

  function addToRoute() {
    const info = findCountry(country);
    if (!info || !nDays || !daily) return;
    const last = [...stops].sort((a, b) => a.endDate.localeCompare(b.endDate)).pop();
    const start = last ? addDays(last.endDate, 1) : settings.departureDate || today();
    void saveStops([...stops, {
      id: crypto.randomUUID(), country: info.name, flag: info.flag, currency: info.currency,
      startDate: start, endDate: addDays(start, nDays - 1), dailyBudget: Math.round(daily * 100),
    }]);
    navigate("/trip/route");
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Link to="/trip/countries" className="font-semibold">← Countries</Link>
      <h2 className="text-2xl font-extrabold">🧮 Can I afford it?</h2>

      <div className="card grid gap-4">
        <label className="label">Country
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            {cards.map((c) => <option key={c.country} value={c.country}>{c.flag} {c.country}</option>)}
          </select>
        </label>
        <label className="label">How many days?
          <input className="input" type="number" min={1} max={365} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
        <div>
          <p className="label mb-2">Travel style</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["budget", "🎒 Backpacker", card ? `£${dailyTotal(card, "budget")}/day` : ""],
              ["midRange", "🏨 Mid-range", card ? `£${dailyTotal(card, "midRange")}/day` : ""],
              ["custom", "✏️ My own", "you choose"],
            ] as [Style, string, string][]).map(([key, label, note]) => (
              <button key={key} onClick={() => setStyle(key)}
                className={`min-h-16 rounded-2xl px-2 text-sm font-semibold ${style === key ? "bg-brand text-white" : "bg-cream"}`}>
                {label}<span className={`block text-xs font-normal ${style === key ? "text-white/80" : "text-muted"}`}>{note}</span>
              </button>
            ))}
          </div>
        </div>
        {style === "custom" && (
          <label className="label">Your daily budget (£)
            <input className="input" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. 40" />
          </label>
        )}
      </div>

      {verdict && (
        <div className={`card grid gap-2 text-white ${verdict === "yes" ? "bg-good" : verdict === "tight" ? "bg-warn" : "bg-bad"}`}>
          <p className="text-sm font-semibold opacity-90">{card?.flag} {nDays} days in {country} · about £{Math.round(daily)}/day</p>
          <p className="text-3xl font-extrabold">{formatMoney(estimate, true)}</p>
          <p className="font-semibold">
            {verdict === "yes" && `✅ You can afford it, with ${formatMoney(spare - estimate, true)} to spare after your route plan.`}
            {verdict === "tight" && `🟠 Only if you change your plan: it's ${formatMoney(estimate - spare, true)} more than your spare money, but within your total money left.`}
            {verdict === "no" && `🔴 That's ${formatMoney(estimate - available, true)} more than all your money left.`}
          </p>
          <p className="text-sm opacity-90">
            {spare > 0
              ? `Your spare money covers about ${affordableDays} day${affordableDays === 1 ? "" : "s"} there at this style.`
              : "Your current route plan already uses all your money."}
          </p>
        </div>
      )}

      <div className="card grid gap-1 text-sm">
        <p className="mb-1 font-bold">How it's worked out</p>
        <Row label="Money left (including family support still to come)" value={formatMoney(available, true)} />
        <Row label="Still planned for your route" value={`− ${formatMoney(planned, true)}`} />
        <Row label="Spare money" value={formatMoney(spare, true)} bold />
        {card && style !== "custom" && (
          <p className="mt-2 text-xs text-muted">
            Typical costs from the {country} card: accommodation £{card.costs[style].accommodation}, food £{card.costs[style].food},
            transport £{card.costs[style].transport}, activities £{card.costs[style].activities} a day. Flights between countries aren't included.
          </p>
        )}
      </div>

      {verdict && verdict !== "no" && <button className="btn" onClick={addToRoute}>+ Add {nDays} days in {country} to my route</button>}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 ${bold ? "border-t border-black/10 pt-1 font-extrabold" : ""}`}>
      <span>{label}</span><span className="shrink-0">{value}</span>
    </p>
  );
}
