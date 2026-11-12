import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ageInDays, allCards, dailyTotal, regionOf, type CountryCard } from "../countryInfo";
import { formatDate } from "../money";
import { useTrip } from "../store";

// A library of country cards. Countries on your route come first.

export default function Countries() {
  const { stops, cardEdits } = useTrip();
  const [search, setSearch] = useState("");
  const cards = useMemo(() => allCards(cardEdits), [cardEdits]);

  const q = search.trim().toLowerCase();
  const shown = cards.filter((c) => !q || c.country.toLowerCase().includes(q));
  const onRoute = stops
    .map((s) => shown.find((c) => c.country === s.country))
    .filter((c, i, list): c is CountryCard => !!c && list.indexOf(c) === i);
  const others = shown.filter((c) => !onRoute.includes(c));
  const regions = [...new Set(others.map((c) => regionOf(c.country)))];

  return (
    <div className="grid grid-cols-1 gap-4">
      <Link to="/trip/afford" className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-good to-sky-600 p-5 text-white shadow-sm">
        <span className="text-4xl">🧮</span>
        <span>
          <span className="block text-lg font-extrabold">Can I afford it?</span>
          <span className="block text-sm opacity-90">Pick a country and a number of days to see the cost against your money left.</span>
        </span>
      </Link>

      <p className="rounded-2xl bg-sun/25 p-3 text-sm">
        ⚠️ Visa, health and entry rules change. Each card shows when it was last checked. Always confirm on GOV.UK and TravelHealthPro before you travel.
      </p>

      <input className="input" type="search" placeholder="🔍 Search countries" value={search} onChange={(e) => setSearch(e.target.value)} />

      {onRoute.length > 0 && <Section title="On your route" cards={onRoute} />}
      {regions.map((r) => <Section key={r} title={r} cards={others.filter((c) => regionOf(c.country) === r)} />)}
      {shown.length === 0 && <p className="text-center text-muted">No countries match "{search}".</p>}
    </div>
  );
}

function Section({ title, cards }: { title: string; cards: CountryCard[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((c) => {
          const old = ageInDays(c) > 90;
          return (
            <Link key={c.country} to={`/trip/countries/${encodeURIComponent(c.country)}`}
              className="flex items-center gap-3 rounded-3xl bg-surface p-4 ring-1 ring-ink/10 active:bg-cream">
              <span className="text-4xl">{c.flag}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{c.country}</span>
                <span className="block text-sm text-muted">Backpacker ~£{dailyTotal(c, "budget")}/day · mid-range ~£{dailyTotal(c, "midRange")}</span>
                <span className={`block text-xs ${old ? "font-semibold text-warn" : "text-muted"}`}>
                  {old ? "⚠️ " : ""}Checked {formatDate(c.lastChecked, "long")}
                </span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
