import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useGroups } from "../groups/GroupsProvider";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { countReports } from "../admin/adminApi";
import { PALETTES, getPalette, getThemeChoice, setPalette, setThemeChoice, type Palette, type ThemeChoice } from "../lib/theme";

// Your public profile (just a display name for now) and account options.

export default function Profile() {
  const { session, demo, displayName, isAdmin, signOut } = useAuth();
  const [name, setName] = useState(displayName);
  const [saved, setSaved] = useState<string | null>(null);
  const [reportCount, setReportCount] = useState(0);
  useEffect(() => { if (isAdmin) countReports().then(setReportCount); }, [isAdmin]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", session.user.id);
    setSaved(error ? "Couldn't save. Please try again." : "Saved ✓");
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="text-3xl font-extrabold"><span className="page-title">Profile</span></h1>
      <div className="card flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-coral to-brand text-2xl font-bold text-on-brand">
          {(displayName || "?").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xl font-bold">
            {displayName}
            {isAdmin && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-extrabold text-on-brand">🛡️ Admin</span>}
          </div>
          <div className="text-sm text-muted">{demo ? "Demo account" : session?.user.email}</div>
        </div>
      </div>

      {!demo && (
        <form onSubmit={save} className="card grid gap-4">
          <h2 className="text-lg font-bold">Public profile</h2>
          <p className="text-sm text-muted">This is the only thing other travellers see about you. Your My Trip data is never shown.</p>
          <label className="label">Display name
            <input className="input" required maxLength={40} value={name} onChange={(e) => { setName(e.target.value); setSaved(null); }} />
          </label>
          <div className="flex items-center gap-3">
            <button className="btn">Save</button>
            {saved && <span className="text-sm font-semibold text-good">{saved}</span>}
          </div>
        </form>
      )}

      {isAdmin && (
        <Link to="/admin" className="card card-accent flex items-center justify-between gap-3">
          <span>
            <span className="block text-lg font-bold">🛡️ Admin tools</span>
            <span className="block text-sm">
              {reportCount > 0 ? <b>{reportCount} report{reportCount === 1 ? "" : "s"} waiting</b> : "No reports waiting"} · suspensions · verified businesses
            </span>
          </span>
          <span className="text-2xl">→</span>
        </Link>
      )}

      <Appearance />

      <BlockedPeople />

      <button onClick={signOut} className="btn-soft">{demo ? "Leave demo" : "Log out"}</button>
    </div>
  );
}

/** People you've blocked in group chats, with a button to unblock. */
function BlockedPeople() {
  const { api, refreshBlocked } = useGroups();
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => { api.listBlocked().then(setList).catch(() => setList([])); }, [api]);

  async function unblock(id: string) {
    await api.unblock(id);
    setList((l) => (l ?? []).filter((p) => p.id !== id));
    await refreshBlocked();
  }

  return (
    <section className="card grid gap-3">
      <h2 className="text-lg font-bold">🚫 Blocked people</h2>
      {list === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">You haven't blocked anyone. To block someone, tap one of their messages in a group.</p>
      ) : (
        list.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3">
            <span className="font-semibold">{p.name}</span>
            <button className="btn-soft min-h-10 px-4 text-sm" onClick={() => unblock(p.id)}>Unblock</button>
          </div>
        ))
      )}
    </section>
  );
}

/** Colour theme, plus bright (default), dark, or follow the device's setting. */
function Appearance() {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);
  const [palette, setPal] = useState<Palette>(getPalette);
  const modes: [ThemeChoice, string][] = [["light", "☀️ Bright"], ["dark", "🌙 Dark"], ["system", "📱 Match device"]];
  return (
    <section className="card grid gap-4">
      <h2 className="text-xl font-extrabold">🎨 Appearance</h2>
      <div>
        <p className="label mb-2">Colour theme</p>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p) => (
            <button key={p.id} onClick={() => { setPalette(p.id); setPal(p.id); }}
              aria-pressed={palette === p.id}
              className={`flex min-h-14 items-center gap-3 rounded-2xl bg-cream px-3 text-left text-sm font-bold transition active:scale-95 ${palette === p.id ? "ring-3 ring-brand-strong" : ""}`}>
              <span className="flex -space-x-1.5">
                {p.colours.map((c) => <span key={c} className="h-6 w-6 rounded-full ring-2 ring-cream" style={{ background: c }} />)}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2">Brightness</p>
        <div className="grid grid-cols-3 gap-2">
          {modes.map(([value, label]) => (
            <button key={value} onClick={() => { setThemeChoice(value); setChoice(value); }}
              className={`min-h-12 rounded-2xl px-2 text-sm font-semibold transition active:scale-95 ${choice === value ? "bg-brand text-on-brand" : "bg-cream"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
