import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { findCountry } from "../countries";
import { EUROPE, ageInDays, dailyTotal, getCard, isEurope, type CountryCard, type DailyCosts } from "../countryInfo";
import { formatLocal, fromPence } from "../fx";
import { formatDate, today } from "../money";
import { useTrip } from "../store";

// One country's card. Tap "Edit" to change anything (saved on this device only),
// and "Mark as checked today" after confirming the details on the official sites.

const COST_ROWS: { key: keyof DailyCosts; label: string; emoji: string }[] = [
  { key: "accommodation", label: "Accommodation", emoji: "🏨" },
  { key: "food", label: "Food", emoji: "🍜" },
  { key: "transport", label: "Local transport", emoji: "🚌" },
  { key: "activities", label: "Activities", emoji: "🎟️" },
];

export default function CountryDetail() {
  const { name = "" } = useParams();
  const country = decodeURIComponent(name);
  const { cardEdits, saveCardEdits, fx } = useTrip();
  const [editing, setEditing] = useState(false);
  const card = getCard(country, cardEdits);

  if (!card) {
    return (
      <div className="card text-center">
        <p className="font-bold">No card for {country} yet.</p>
        <Link to="/trip/countries" className="btn-soft mt-3">All countries</Link>
      </div>
    );
  }

  const edited = !!cardEdits[country];
  const old = ageInDays(card) > 90;
  const currency = findCountry(country)?.currency;
  const local = (pounds: number) => (currency && currency !== "GBP" ? formatLocal(fromPence(pounds * 100, currency, fx), currency) : "");

  async function update(patch: Partial<CountryCard>) {
    await saveCardEdits({ ...cardEdits, [country]: { ...cardEdits[country], ...patch } });
  }
  async function reset() {
    if (!confirm(`Remove your changes to ${country} and go back to the built-in card?`)) return;
    const next = { ...cardEdits };
    delete next[country];
    await saveCardEdits(next);
    setEditing(false);
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Link to="/trip/countries" className="font-semibold">← All countries</Link>

      <div className="card grid gap-2">
        <div className="flex items-center gap-3">
          <span className="text-5xl">{card.flag}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold">{card.country}</h2>
            <p className={`text-sm ${old ? "font-semibold text-warn" : "text-muted"}`}>
              {old ? "⚠️ " : ""}Last checked {formatDate(card.lastChecked, "long")}{edited ? " · includes your edits" : ""}
            </p>
          </div>
          <button onClick={() => setEditing((e) => !e)} className={`rounded-full px-4 py-2 text-sm font-semibold ${editing ? "bg-brand text-on-brand" : "bg-cream"}`}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <p>{card.summary}</p>
        <div className="rounded-2xl bg-sun/25 p-3 text-sm">
          ⚠️ Rules and prices change. Check the official sites below before you travel, then tap
          <button onClick={() => update({ lastChecked: today() })} className="mx-1 font-bold text-brand-strong underline">Mark as checked today</button>.
        </div>
        <div className="flex flex-wrap gap-2">
          {card.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-strong">
              {l.label} ↗
            </a>
          ))}
        </div>
        {editing && edited && <button onClick={reset} className="text-left text-sm font-semibold text-bad">Undo my edits to this card</button>}
      </div>

      {card.mustKnow.length > 0 && (
        <Box title="⚠️ Must know" tone="warn">
          <ListField items={card.mustKnow} editing={editing} onSave={(v) => update({ mustKnow: v })} />
        </Box>
      )}

      <Box title="💷 Typical daily costs (per person)">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 text-sm">
          <span />
          <span className="text-right font-bold">Backpacker</span>
          <span className="text-right font-bold">Mid-range</span>
          {COST_ROWS.map((r) => (
            <CostRow key={r.key} label={`${r.emoji} ${r.label}`} editing={editing}
              budget={card.costs.budget[r.key]} mid={card.costs.midRange[r.key]}
              onSave={(b, m) => update({ costs: {
                budget: { ...card.costs.budget, [r.key]: b },
                midRange: { ...card.costs.midRange, [r.key]: m },
              } })}
            />
          ))}
          <span className="border-t border-ink/15 pt-2 font-extrabold">Total per day</span>
          <span className="border-t border-ink/15 pt-2 text-right font-extrabold">£{dailyTotal(card, "budget")}<br /><span className="text-xs font-normal text-muted">{local(dailyTotal(card, "budget"))}</span></span>
          <span className="border-t border-ink/15 pt-2 text-right font-extrabold">£{dailyTotal(card, "midRange")}<br /><span className="text-xs font-normal text-muted">{local(dailyTotal(card, "midRange"))}</span></span>
        </div>
        <p className="mt-2 text-xs text-muted">Estimates. Backpacker = hostel dorms, cheap eats, local buses. Mid-range = private rooms, restaurants, some tours.</p>
      </Box>

      <Box title="💱 Money">
        <TextField label="Currency" value={card.money.currency} editing={editing} onSave={(v) => update({ money: { ...card.money, currency: v } })} />
        <TextField label="Cash or card" value={card.money.cashOrCard} editing={editing} onSave={(v) => update({ money: { ...card.money, cashOrCard: v } })} />
        <TextField label="ATMs and fees" value={card.money.atms} editing={editing} onSave={(v) => update({ money: { ...card.money, atms: v } })} />
        <TextField label="Tipping" value={card.money.tipping} editing={editing} onSave={(v) => update({ money: { ...card.money, tipping: v } })} />
      </Box>

      <Box title="🛂 Entry rules (UK passport)">
        <ListField items={card.entry} editing={editing} onSave={(v) => update({ entry: v })} />
      </Box>

      <Box title="💉 Health and vaccinations">
        <ListField items={card.health} editing={editing} onSave={(v) => update({ health: v })} />
        <p className="mt-2 text-xs text-muted">Book a travel clinic appointment several weeks before you go: some vaccines need more than one dose.</p>
      </Box>

      <Box title="🛡️ Scams and staying safe">
        <ListField items={card.safety} editing={editing} onSave={(v) => update({ safety: v })} />
      </Box>

      <Box title="🔌 Practical">
        <TextField label="Plugs" value={card.practical.plugs} editing={editing} onSave={(v) => update({ practical: { ...card.practical, plugs: v } })} />
        <TextField label="Emergency numbers" value={card.practical.emergency} editing={editing} onSave={(v) => update({ practical: { ...card.practical, emergency: v } })} />
        <TextField label="SIM / eSIM" value={card.practical.sim} editing={editing} onSave={(v) => update({ practical: { ...card.practical, sim: v } })} />
      </Box>

      {isEurope(country) && EUROPE && <EuropeBox />}
    </div>
  );
}

function EuropeBox() {
  const e = EUROPE!;
  return (
    <Box title="🇪🇺 Europe-wide (Schengen, EES, ETIAS, GHIC, Interrail)">
      <p className="text-sm">{e.schengen90180}</p>
      <SubList title="Entry/Exit System (EES)" items={e.ees} />
      <SubList title="ETIAS" items={e.etias} />
      <SubList title="GHIC (healthcare card)" items={e.ghic} />
      <SubList title="Interrail passes" items={e.interrail.passes} />
      <SubList title="Seat reservations" items={e.interrail.reservations} />
      <SubList title="Interrail tips" items={e.interrail.tips} />
      <div className="mt-2 flex flex-wrap gap-2">
        {e.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-strong">{l.label} ↗</a>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Checked {formatDate(e.lastChecked, "long")}.</p>
    </Box>
  );
}

function SubList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-bold">{title}</p>
      <ul className="mt-1 grid gap-1 text-sm">{items.map((i) => <li key={i} className="flex gap-2"><span>•</span><span>{i}</span></li>)}</ul>
    </div>
  );
}

function Box({ title, children, tone }: { title: string; children: ReactNode; tone?: "warn" }) {
  return (
    <section className={`rounded-3xl p-5 ring-1 ring-ink/10 ${tone === "warn" ? "bg-sun/20" : "bg-surface"}`}>
      <h3 className="mb-2 text-lg font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

function TextField({ label, value, editing, onSave }: { label: string; value: string; editing: boolean; onSave: (v: string) => void }) {
  return editing ? (
    <label className="label mb-2">{label}
      <textarea className="input min-h-16 py-2 font-normal" defaultValue={value} onBlur={(e) => e.target.value !== value && onSave(e.target.value.trim())} />
    </label>
  ) : (
    <p className="mb-2 text-sm"><b>{label}:</b> {value}</p>
  );
}

function ListField({ items, editing, onSave }: { items: string[]; editing: boolean; onSave: (v: string[]) => void }) {
  if (editing) {
    return (
      <label className="label">One point per line
        <textarea className="input min-h-32 py-2 font-normal" defaultValue={items.join("\n")}
          onBlur={(e) => {
            const next = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
            if (next.join("\n") !== items.join("\n")) onSave(next);
          }} />
      </label>
    );
  }
  return <ul className="grid gap-1.5 text-sm">{items.map((i) => <li key={i} className="flex gap-2"><span>•</span><span>{i}</span></li>)}</ul>;
}

function CostRow({ label, budget, mid, editing, onSave }: {
  label: string; budget: number; mid: number; editing: boolean; onSave: (budget: number, mid: number) => void;
}) {
  if (!editing) {
    return (
      <>
        <span>{label}</span>
        <span className="text-right">£{budget}</span>
        <span className="text-right">£{mid}</span>
      </>
    );
  }
  const num = (v: string, fallback: number) => Math.max(0, Math.round(parseFloat(v) || fallback));
  return (
    <>
      <span>{label}</span>
      <input className="input min-h-10 w-20 text-right" inputMode="numeric" defaultValue={budget} aria-label={`${label} backpacker £`}
        onBlur={(e) => onSave(num(e.target.value, budget), mid)} />
      <input className="input min-h-10 w-20 text-right" inputMode="numeric" defaultValue={mid} aria-label={`${label} mid-range £`}
        onBlur={(e) => onSave(budget, num(e.target.value, mid))} />
    </>
  );
}
