import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

// The frame around every page: a sidebar on laptops and a bottom tab bar on phones.

export const MAIN_TABS = [
  { to: "/discover", label: "Discover", icon: "✨" },
  { to: "/groups", label: "Groups", icon: "💬" },
  { to: "/post", label: "Post", icon: "➕" },
  { to: "/trip", label: "My Trip", icon: "🔒" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

export default function AppLayout() {
  const { demo, displayName, signOut } = useAuth();
  return (
    <div className="min-h-dvh md:flex">
      {/* Laptop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-ink/10 bg-surface p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-extrabold">
          <img src="/favicon.svg" alt="" className="h-8 w-8" /> Gap Year Hub
        </div>
        {MAIN_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-semibold transition ${
                isActive ? "bg-brand text-white shadow-sm" : "text-ink hover:bg-brand-soft"
              }`
            }
          >
            <span className="text-xl">{t.icon}</span> {t.label}
          </NavLink>
        ))}
        <div className="mt-auto rounded-2xl bg-cream p-3 text-sm">
          <div className="font-semibold">{displayName}</div>
          <button onClick={signOut} className="text-muted underline">{demo ? "Leave demo" : "Log out"}</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {demo && (
          <div className="bg-sun px-4 py-2 text-center text-sm font-semibold text-[#1F1B2D]">
            👀 Demo with made-up data ·{" "}
            <button onClick={signOut} className="underline">Create your own account</button>
          </div>
        )}
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Phone tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-surface/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {MAIN_TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  isActive ? "text-brand" : "text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-9 w-12 place-items-center rounded-full text-xl transition ${isActive ? "bg-brand-soft" : ""}`}>
                    {t.icon}
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
