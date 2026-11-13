import { Compass, Luggage, MessagesSquare, Plus, UserRound, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";
import { DEMO_ROLES, type DemoRole } from "../lib/demoRole";

// The frame around every page: a sidebar on laptops, a bottom tab bar on phones,
// and soft colourful shapes floating in the background.

export const MAIN_TABS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: "/discover", label: "Discover", Icon: Compass },
  { to: "/groups", label: "Groups", Icon: MessagesSquare },
  { to: "/post", label: "Post", Icon: Plus },
  { to: "/trip", label: "My Trip", Icon: Luggage },
  { to: "/profile", label: "Profile", Icon: UserRound },
];

/** Big blurred blobs in the theme colours, drifting slowly behind everything. */
export function BackgroundShapes() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="animate-float absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand opacity-[0.16] blur-3xl" />
      <div className="animate-float absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-coral opacity-[0.11] blur-3xl [animation-delay:-5s]" />
      <div className="animate-float absolute -bottom-24 right-1/4 h-80 w-96 rounded-full bg-sun opacity-[0.14] blur-3xl [animation-delay:-9s]" />
      <svg className="absolute bottom-0 left-0 w-full text-brand-strong opacity-[0.07]" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path fill="currentColor" d="M0 96c120-30 240-46 360-30s240 62 360 64 240-42 360-58 240 6 360 22v66H0z" />
      </svg>
    </div>
  );
}

export default function AppLayout() {
  const { demo, displayName, isSuspended, signOut, demoRole, setDemoRole } = useAuth();
  const navigate = useNavigate();

  function switchView(value: string) {
    if (value === "loggedout") { void signOut(); return; } // shows the welcome page; "Try the demo" comes back
    setDemoRole(value as DemoRole);
    if (value === "admin" || value === "moderator") navigate("/admin");
  }
  return (
    <div className="relative isolate min-h-dvh md:flex">
      <BackgroundShapes />

      {/* Laptop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1.5 p-4 md:flex">
        <div className="mb-6 px-2"><Logo size={38} /></div>
        {MAIN_TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold transition hover:translate-x-0.5 ${
                isActive ? "bg-brand text-on-brand shadow-md" : "text-ink hover:bg-surface"
              }`
            }
          >
            <Icon size={22} strokeWidth={2.4} className="transition group-hover:scale-110" /> {label}
          </NavLink>
        ))}
        <div className="mt-auto rounded-2xl bg-surface p-3 text-sm">
          <div className="font-bold">{displayName}</div>
          <button onClick={signOut} className="text-muted underline">{demo ? "Leave demo" : "Log out"}</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-sun px-4 py-2 text-center text-sm font-semibold text-[#1F1B2D]">
            <span>👀 Demo with made-up data</span>
            <label className="flex items-center gap-1">
              Viewing as
              <select
                value={demoRole}
                onChange={(e) => switchView(e.target.value)}
                className="rounded-full bg-white/70 px-2 py-0.5 font-bold text-[#1F1B2D] ring-1 ring-black/10"
                aria-label="View the demo as"
              >
                {DEMO_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                <option value="loggedout">Logged out</option>
              </select>
            </label>
            <button onClick={signOut} className="underline">Create your own account</button>
          </div>
        )}
        {isSuspended && (
          <div className="bg-bad px-4 py-2 text-center text-sm font-semibold text-white">
            Your account has been suspended for breaking the community rules. You can still look around and use My Trip,
            but you can't post, message, like or join groups.
          </div>
        )}
        {/* Phone header with the logo */}
        <header className="flex items-center px-4 pt-4 md:hidden"><Logo size={30} /></header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Phone tab bar */}
      <nav className="safe-bottom fixed inset-x-3 bottom-3 z-20 rounded-[1.75rem] bg-surface/90 shadow-lg ring-1 ring-ink/5 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {MAIN_TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition active:scale-90 ${
                  isActive ? "text-brand-strong" : "text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-9 w-12 place-items-center rounded-full transition ${
                    to === "/post" ? "bg-brand text-on-brand" : isActive ? "bg-brand-soft" : ""
                  } ${isActive ? "scale-110" : ""}`}>
                    <Icon size={22} strokeWidth={2.4} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
