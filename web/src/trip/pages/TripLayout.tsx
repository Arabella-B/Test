import { Link, NavLink, Outlet } from "react-router-dom";
import Celebrations from "../components/Celebrations";
import LockScreen, { useTripLock } from "../components/LockScreen";
import QuickAdd from "../components/QuickAdd";
import { daysBetween, today } from "../money";
import { useTrip } from "../store";

// Frame for the private My Trip section: a row of big buttons for its pages,
// plus a reminder to back up.

const TRIP_TABS = [
  { to: "/trip", label: "Dashboard", icon: "📊", end: true },
  { to: "/trip/import", label: "Import", icon: "📥" },
  { to: "/trip/transactions", label: "Transactions", icon: "📋" },
  { to: "/trip/route", label: "Route", icon: "🗺️" },
  { to: "/trip/budgets", label: "Budgets", icon: "🎯" },
  { to: "/trip/countries", label: "Countries", icon: "🌍" },
  { to: "/trip/checklist", label: "Checklist", icon: "✅" },
  { to: "/trip/settings", label: "Settings", icon: "⚙️" },
];

export default function TripLayout() {
  const { ready, isDemo, transactions, settings, scope } = useTrip();
  const lock = useTripLock(scope);

  const lastBackup = settings.lastBackupAt?.slice(0, 10);
  const needsBackup = !isDemo && transactions.length > 0 && (!lastBackup || daysBetween(lastBackup, today()) >= 14);

  if (lock.locked) {
    return <LockScreen scope={scope} onUnlock={lock.unlock} />;
  }

  return (
    // Extra space at the bottom so the floating "+ Cash" button never hides the last item.
    <div className="grid grid-cols-1 gap-5 pb-20 md:pb-16">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-extrabold"><span className="page-title">My Trip</span></h1>
        <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-cream">🔒 Private</span>
      </div>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {TRIP_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
                isActive ? "bg-brand text-on-brand shadow-sm" : "bg-surface text-ink ring-1 ring-ink/10"
              }`
            }
          >
            <span>{t.icon}</span>{t.label}
          </NavLink>
        ))}
      </nav>

      {needsBackup && (
        <Link to="/trip/settings#backup" className="flex items-center gap-3 rounded-3xl bg-sun/25 p-4 text-sm font-semibold">
          <span className="text-2xl">💾</span>
          <span>{lastBackup ? "It's been a while since your last backup." : "You haven't backed up yet."} Your data lives only on this device. Tap to back up.</span>
        </Link>
      )}

      {ready ? <Outlet /> : <div className="card text-center text-muted">Loading your trip…</div>}
      {ready && <QuickAdd />}
      {ready && <Celebrations />}
    </div>
  );
}
