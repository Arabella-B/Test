import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CHART_GROUPS, GROUP_COLOURS as colours, getGroup, groupOf, totalsByGroup } from "../chartGroups";
import { CategoryIcon } from "../components/CategoryPicker";
import { computeInsights, type Insight } from "../insights";
import { addDays, formatDate, formatMoney, today } from "../money";
import { countableTransactions, stopStats } from "../route";
import { computeStats } from "../stats";
import { useTrip } from "../store";
import { useThemeColours } from "../../lib/useThemeColour";

// The "understand everything in 5 seconds" page: headline numbers, tips and
// colourful charts. Tapping any chart opens the matching transactions.

const STATUS = {
  good: { bg: "bg-good", text: "On track", soft: "bg-good/10 text-good" },
  close: { bg: "bg-warn", text: "Cutting it close", soft: "bg-warn/10 text-warn" },
  over: { bg: "bg-bad", text: "Runs out early", soft: "bg-bad/10 text-bad" },
  unknown: { bg: "bg-muted", text: "Not enough data", soft: "bg-ink/10 text-muted" },
};

const pounds = (v: unknown) => formatMoney(Math.round(Number(v) * 100), true);

export default function Dashboard() {
  const { transactions, settings, hasSettings, isDemo, stops, budgets, cardEdits } = useTrip();
  const navigate = useNavigate();
  const theme = useThemeColours(["brand", "brand-strong", "grid"]);
  const stats = useMemo(() => computeStats(transactions, settings), [transactions, settings]);
  const insights = useMemo(() => computeInsights(transactions, settings, { stops, budgets, cardEdits }), [transactions, settings, stops, budgets, cardEdits]);
  const groups = useMemo(() => totalsByGroup(stats.byCategory), [stats.byCategory]);
  const monthlyGroups = useMemo(() => {
    const rows = stats.monthly.map((row) => {
      const out: Record<string, number | string> = { month: row.month, key: row.key };
      for (const [k, v] of Object.entries(row)) {
        if (k === "month" || k === "key" || typeof v !== "number") continue;
        const g = groupOf(k);
        out[g] = ((out[g] as number) ?? 0) + v;
      }
      return out;
    });
    const used = CHART_GROUPS.map((g) => g.id).filter((id) => rows.some((r) => typeof r[id] === "number"));
    return { rows, used };
  }, [stats.monthly]);
  const countries = useMemo(() => {
    const countable = countableTransactions(transactions, settings);
    return stops.map((s) => stopStats(s, countable));
  }, [stops, transactions, settings]);

  if (transactions.length === 0) return <GetStarted hasSettings={hasSettings} />;

  const status = STATUS[stats.runway.status];
  const leftShare = settings.totalBudget > 0 ? stats.moneyLeft / (settings.totalBudget + stats.income) : 1;
  const leftTone = leftShare > 0.3 ? "text-good" : leftShare > 0.1 ? "text-warn" : "text-bad";
  const go = (query: string) => navigate(`/trip/transactions?${query}`);

  return (
    <div className="grid grid-cols-1 gap-4">
      {!hasSettings && !isDemo && (
        <Link to="/trip/settings" className="rounded-3xl bg-sun/25 p-4 text-sm font-semibold">
          ⚙️ Add your total budget and dates in Settings to see money left and your runway.
        </Link>
      )}

      {/* Headline cards */}
      <div className="pop-in grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Headline label="Money left" value={formatMoney(stats.moneyLeft, true)} valueClass={leftTone} note={`of ${formatMoney(settings.totalBudget, true)} + ${formatMoney(stats.income, true)} in`} />
        <Headline tint="card-accent" label="Spent this month" value={formatMoney(stats.spentThisMonth, true)} note={new Date().toLocaleDateString("en-GB", { month: "long" })} />
        <Headline tint="card-sun" label="Average per day" value={formatMoney(stats.averageDaily, true)} note="last 30 days" />
        <div className="card relative overflow-hidden p-4">
          <p className="text-sm font-semibold text-muted">Runway</p>
          <p className="mt-1 text-2xl font-extrabold">{stats.runway.date ? formatDate(stats.runway.date, "long") : "–"}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${status.soft}`}>{status.text}</span>
          <span className={`absolute inset-y-0 right-0 w-2 ${status.bg}`} />
        </div>
      </div>
      {stats.runway.date && (
        <p className="-mt-1 px-1 text-sm text-muted">
          At this rate your money lasts until <b className="text-ink">{formatDate(stats.runway.date, "long")}</b>
          {stats.runway.futureFamily > 0 && <> (including about {formatMoney(stats.runway.futureFamily, true)} of family support still to come)</>}
          {settings.returnDate && <>. You're due home {formatDate(settings.returnDate, "long")}</>}.
          {stats.runway.dailyToLastUntilReturn !== null && (
            stats.runway.status === "over"
              ? <> To make it, aim for <b className="text-ink">{formatMoney(stats.runway.dailyToLastUntilReturn, true)}/day</b>.</>
              : <> You can spend up to <b className="text-ink">{formatMoney(stats.runway.dailyToLastUntilReturn, true)}/day</b> and still make it.</>
          )}
        </p>
      )}

      {/* Top tips */}
      <div className="pop-in grid gap-3 md:grid-cols-2">
        {insights.slice(0, 2).map((i) => <InsightCard key={i.id} insight={i} />)}
      </div>

      {/* Fees counter */}
      <button onClick={() => go("category=fees")} className="flex items-center gap-4 rounded-[1.75rem] bg-bad/15 p-5 text-left transition hover:-translate-y-0.5">
        <span className="text-4xl">💱</span>
        <span>
          <span className="block text-sm font-semibold opacity-90">Lost to bank fees so far</span>
          <span className="block font-display text-3xl font-extrabold text-bad">{formatMoney(stats.fees)}</span>
        </span>
      </button>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Donut by category */}
        <section className="card">
          <h2 className="mb-2 text-lg font-extrabold">Where your money goes</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={groups.map((g) => ({ ...g, value: g.total / 100, name: getGroup(g.groupId).name }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="95%"
                  paddingAngle={3}
                  cornerRadius={8}
                  onClick={(entry) => go(`group=${(entry as unknown as { groupId: string }).groupId}`)}
                  className="cursor-pointer"
                >
                  {groups.map((g) => <Cell key={g.groupId} fill={colours[g.groupId]} stroke="none" />)}
                </Pie>
                <Tooltip formatter={pounds} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid gap-1">
            {groups.map((g) => {
              const group = getGroup(g.groupId);
              return (
                <button key={g.groupId} onClick={() => go(`group=${g.groupId}`)} className="flex items-center gap-2 rounded-xl px-1 py-1 text-left text-sm hover:bg-cream">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: colours[g.groupId] }} />
                  <span className="flex-1">{group.emoji} {group.name}</span>
                  <span className="font-semibold">{formatMoney(g.total, true)}</span>
                  <span className="w-10 text-right text-muted">{Math.round((g.total / Math.max(1, stats.spent)) * 100)}%</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Spending vs budget */}
        <section className="card">
          <h2 className="mb-1 text-lg font-extrabold">Spending vs your plan</h2>
          <p className="mb-2 text-sm text-muted">Total spent so far compared with spending evenly until you're home.</p>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={stats.budgetLine} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} minTickGap={40} fontSize={12} />
                <YAxis tickFormatter={(v) => `£${Math.round(v / 1000)}k`} width={44} fontSize={12} />
                <Tooltip formatter={pounds} labelFormatter={(d) => formatDate(String(d), "long")} />
                <Legend />
                <Line type="monotone" dataKey="plan" name="Plan" stroke="#9CA3AF" strokeDasharray="6 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actual" name="Spent" stroke={theme["brand-strong"]} dot={false} strokeWidth={3} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Monthly stacked bars */}
      <section className="card">
        <h2 className="mb-2 text-lg font-extrabold">Each month</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthlyGroups.rows} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis tickFormatter={(v) => `£${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}`} width={48} fontSize={12} />
              <Tooltip formatter={(v, name) => [pounds(v), getGroup(String(name)).name]} />
              <Legend formatter={(id) => getGroup(String(id)).name} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {monthlyGroups.used.map((id, i) => (
                <Bar
                  key={id}
                  dataKey={id}
                  stackId="month"
                  fill={colours[id]}
                  radius={i === monthlyGroups.used.length - 1 ? [8, 8, 0, 0] : 0}
                  onClick={(d) => go(`month=${(d as unknown as { payload: { key: string } }).payload.key}&group=${id}`)}
                  className="cursor-pointer"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Spend per country */}
      {countries.length > 0 && (
        <section className="card">
          <h2 className="mb-1 text-lg font-extrabold">Spend per country</h2>
          <p className="mb-2 text-sm text-muted">Your average spend per day so far, against your target. Tap a country to see its spending.</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart
                data={countries.map((c) => ({
                  name: `${c.stop.flag} ${c.stop.country}`,
                  target: c.stop.dailyBudget / 100,
                  actual: c.actualDaily !== null ? c.actualDaily / 100 : null,
                  status: c.status,
                  from: c.stop.startDate,
                  to: c.stop.endDate,
                }))}
                margin={{ left: 0, right: 8, top: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                <XAxis dataKey="name" fontSize={11} interval={0} tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 11) + "…" : v)} />
                <YAxis tickFormatter={(v) => `£${v}`} width={40} fontSize={12} />
                <Tooltip formatter={(v, name) => [v === null ? "Not started" : `${pounds(v)}/day`, name === "target" ? "Target" : "Actual"]} />
                <Legend formatter={(v) => (v === "target" ? "Target per day" : "Actual per day")} />
                <Bar dataKey="target" fill={theme.brand} radius={[6, 6, 0, 0]} />
                <Bar
                  dataKey="actual"
                  fill="#16A34A"
                  radius={[6, 6, 0, 0]}
                  className="cursor-pointer"
                  onClick={(d) => { const p = (d as unknown as { payload: { from: string; to: string } }).payload; go(`from=${p.from}&to=${p.to}`); }}
                >
                  {countries.map((c) => (
                    <Cell key={c.stop.id} fill={c.status === "over" ? "#DC2626" : c.status === "close" ? "#D97706" : "#16A34A"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top merchants */}
        <section className="card">
          <h2 className="mb-3 text-lg font-extrabold">Top 5 places</h2>
          <div className="grid grid-cols-1 gap-2">
            {stats.topMerchants.map((m, i) => {
              const sample = transactions.find((t) => t.merchant === m.merchant);
              return (
                <button key={m.merchant} onClick={() => go(`search=${encodeURIComponent(m.merchant)}`)} className="flex items-center gap-3 rounded-2xl p-1 text-left hover:bg-cream">
                  <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
                  <CategoryIcon id={sample?.categoryId ?? "uncategorised"} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.merchant}</span>
                    <span className="text-xs text-muted">{m.count} payment{m.count === 1 ? "" : "s"}</span>
                  </span>
                  <span className="font-bold">{formatMoney(m.total, true)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Heatmap */}
        <section className="card">
          <h2 className="mb-1 text-lg font-extrabold">Daily spending</h2>
          <p className="mb-3 text-sm text-muted">Last 12 weeks. Darker means more spent. Tap a day.</p>
          <Heatmap daily={stats.daily} onPick={(d) => go(`date=${d}`)} />
        </section>
      </div>

      {insights.length > 2 && (
        <section className="grid grid-cols-1 gap-3">
          <h2 className="text-lg font-extrabold">More tips for you</h2>
          <div className="pop-in grid gap-3 md:grid-cols-2">
            {insights.slice(2).map((i) => <InsightCard key={i.id} insight={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function Headline({ label, value, note, valueClass = "", tint = "" }: { label: string; value: string; note: string; valueClass?: string; tint?: string }) {
  return (
    <div className={`card p-4 ${tint}`}>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${valueClass}`}>{value}</p>
      <p className="truncate text-xs text-muted">{note}</p>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const tone = insight.tone === "warn" ? "bg-sun/20" : insight.tone === "good" ? "bg-good/10" : "bg-brand-soft";
  const body = (
    <>
      <span className="text-3xl">{insight.emoji}</span>
      <span>
        <span className="block font-bold">{insight.title}</span>
        <span className="block text-sm text-ink/80">{insight.text}</span>
      </span>
    </>
  );
  return insight.link ? (
    <Link to={insight.link} className={`flex gap-3 rounded-3xl p-4 ${tone}`}>{body}</Link>
  ) : (
    <div className={`flex gap-3 rounded-3xl p-4 ${tone}`}>{body}</div>
  );
}

function Heatmap({ daily, onPick }: { daily: Map<string, number>; onPick: (date: string) => void }) {
  const now = today();
  // Start on a Monday 12 weeks ago, so each column is one week.
  const dow = (new Date(now + "T12:00:00Z").getUTCDay() + 6) % 7;
  const start = addDays(now, -(dow + 7 * 11));
  const days = Array.from({ length: 7 * 12 }, (_, i) => addDays(start, i));
  const max = Math.max(1, ...days.map((d) => daily.get(d) ?? 0));
  return (
    <div className="flex gap-2">
      <div className="grid grid-rows-7 gap-1 text-[10px] text-muted">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="flex h-full items-center">{d}</span>)}
      </div>
      <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1">
        {days.map((d) => {
          const v = daily.get(d) ?? 0;
          const future = d > now;
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => onPick(d)}
              title={`${formatDate(d, "long")}: ${formatMoney(v)}`}
              aria-label={`${formatDate(d, "long")}: ${formatMoney(v)}`}
              className="aspect-square rounded-[5px]"
              style={{ background: future ? "transparent" : v === 0 ? "var(--color-heat-empty)" : `color-mix(in srgb, var(--color-brand-strong) ${Math.round(20 + 80 * (v / max))}%, transparent)` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function GetStarted({ hasSettings }: { hasSettings: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="card bg-gradient-to-br from-coral to-brand text-on-brand">
        <p className="text-2xl font-extrabold">Let's set up your trip money 💷</p>
        <p className="mt-1 opacity-90">Three quick steps. Everything stays private on this device.</p>
      </div>
      <Step n={1} done={hasSettings} title="Add your budget and dates" text="Your total money, departure and return dates, and any family support." to="/trip/settings" cta="Open Settings" />
      <Step n={2} done={false} title="Import a bank statement" text="Drag and drop a CSV or PDF. It's categorised automatically." to="/trip/import" cta="Import" />
      <Step n={3} done={false} title="Work through your checklist" text="The most urgent things to do before you leave." to="/trip/checklist" cta="Checklist" />
    </div>
  );
}

function Step({ n, done, title, text, to, cta }: { n: number; done: boolean; title: string; text: string; to: string; cta: string }) {
  return (
    <div className="card flex items-center gap-4">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-extrabold ${done ? "bg-good text-white" : "bg-brand-soft text-brand-strong"}`}>
        {done ? "✓" : n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <Link to={to} className="btn-soft shrink-0 px-4 text-sm">{cta}</Link>
    </div>
  );
}
