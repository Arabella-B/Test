import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { chatTime } from "../groups/GroupsProvider";
import * as admin from "./adminApi";
import SuspendSheet from "./SuspendSheet";

// Admin tools: deal with reports, and choose which businesses can post events.
// Only shown to admins; the database also refuses these actions for anyone else.

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [suspendedVersion, setSuspendedVersion] = useState(0); // reloads the suspended list after a suspension
  if (!isAdmin) return <Navigate to="/profile" replace />;
  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="text-3xl font-extrabold"><span className="page-title">Admin</span></h1>
      <p className="text-sm text-muted">
        🛡️ You're a Wayfund admin. You can post events as <b>Wayfund team</b>, deal with reports, suspend accounts,
        remove any post or message (a post's ⋯ menu, or tap a message in a group), delete any group (tap its name at the top of the chat), and
        verify businesses.
      </p>
      <Reports onSuspended={() => setSuspendedVersion((v) => v + 1)} />
      <Suspended version={suspendedVersion} />
      <VerifiedBusinesses />
    </div>
  );
}

function Reports({ onSuspended }: { onSuspended: () => void }) {
  const [list, setList] = useState<admin.Report[] | null>(null);
  const [suspending, setSuspending] = useState<admin.Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => { admin.listReports().then(setList).catch((e) => { setError(e.message); setList([]); }); }, []);

  async function act(r: admin.Report, action: "dismiss" | "remove") {
    const what = r.postId ? "post" : "message";
    if (action === "remove" && !confirm(`Remove this ${what} by ${r.reportedName} for everyone? This can't be undone.`)) return;
    setBusy(r.id);
    setError(null);
    try {
      if (action === "remove") {
        if (r.postId) await admin.removePost(r.postId);
        else if (r.messageId) await admin.removeMessage(r.messageId);
      }
      await admin.dismissReport(r.id);
      setList((l) => (l ?? []).filter((x) => x.id !== r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(null);
  }

  return (
    <section className="card grid gap-3">
      <h2 className="text-lg font-bold">🚩 Reports {list && list.length > 0 && <span className="ml-1 rounded-full bg-bad px-2 py-0.5 text-sm text-white">{list.length}</span>}</h2>
      {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
      {list === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">No reports. All clear! 🎉</p>
      ) : (
        list.map((r) => {
          const gone = !r.postId && !r.messageId; // already deleted by its author or the group
          return (
            <div key={r.id} className="grid gap-2 rounded-2xl bg-cream p-3">
              <p className="text-xs font-semibold text-muted">
                {r.postId ? "📸 Post" : r.groupName ? `💬 Message in ${r.groupName}` : "💬 Message"} by <b>{r.reportedName}</b> ·
                reported by {r.reporterName} · {chatTime(r.createdAt, true)}
              </p>
              {r.snapshot && <p className="line-clamp-4 whitespace-pre-wrap rounded-xl bg-surface p-2 text-sm">{r.snapshot}</p>}
              <p className="text-sm"><b>Reason:</b> {r.reason}</p>
              {gone && <p className="text-xs font-semibold text-muted">This has already been deleted.</p>}
              <div className="flex flex-wrap gap-2">
                {r.postId && <Link to={`/discover/${r.postId}`} className="btn-soft min-h-10 px-3 text-sm">View post</Link>}
                {!gone && (
                  <button disabled={busy === r.id} onClick={() => act(r, "remove")} className="min-h-10 rounded-2xl px-3 text-sm font-semibold text-bad ring-1 ring-bad/30">
                    Remove {r.postId ? "post" : "message"}
                  </button>
                )}
                <button disabled={busy === r.id} onClick={() => act(r, "dismiss")} className="btn-soft min-h-10 px-3 text-sm">
                  {gone ? "Clear" : "Dismiss, it's fine"}
                </button>
                <button disabled={busy === r.id} onClick={() => setSuspending(r)} className="min-h-10 rounded-2xl px-3 text-sm font-semibold text-bad ring-1 ring-bad/30">
                  Suspend {r.reportedName}
                </button>
              </div>
            </div>
          );
        })
      )}
      {suspending && (
        <SuspendSheet
          userId={suspending.reportedUserId}
          name={suspending.reportedName}
          onClose={() => setSuspending(null)}
          onDone={async () => {
            const done = suspending;
            setSuspending(null);
            try { await admin.dismissReport(done.id); } catch { /* already gone with their content */ }
            setList(await admin.listReports().catch(() => []));
            onSuspended();
          }}
        />
      )}
    </section>
  );
}

function Suspended({ version }: { version: number }) {
  const [list, setList] = useState<admin.Suspension[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { admin.listSuspended().then(setList).catch((e) => { setError(e.message); setList([]); }); }, [version]);

  async function lift(s: admin.Suspension) {
    if (!confirm(`Lift ${s.name}'s suspension? They'll be able to post and message again.`)) return;
    try {
      await admin.unsuspend(s.userId);
      setList((l) => (l ?? []).filter((x) => x.userId !== s.userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't lift it.");
    }
  }

  return (
    <section className="card grid gap-3">
      <h2 className="text-lg font-bold">⛔ Suspended accounts</h2>
      <p className="text-sm text-muted">Suspend someone from a report, or from the ⋯ menu on one of their posts.</p>
      {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
      {list === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">Nobody is suspended.</p>
      ) : (
        list.map((s) => (
          <div key={s.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="text-xs text-muted">{s.reason || "No reason given"} · since {new Date(s.suspendedAt).toLocaleDateString("en-GB")}</p>
            </div>
            <button onClick={() => lift(s)} className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-brand-strong hover:bg-brand-soft">Lift</button>
          </div>
        ))
      )}
    </section>
  );
}

function VerifiedBusinesses() {
  const [list, setList] = useState<admin.VerifiedBusiness[] | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<admin.Person[]>([]);
  const [picked, setPicked] = useState<admin.Person | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { admin.listVerified().then(setList).catch((e) => { setError(e.message); setList([]); }); }, []);

  // Search as you type (after a short pause).
  useEffect(() => {
    if (picked) return;
    const t = setTimeout(() => { admin.findPeople(search).then(setResults).catch(() => setResults([])); }, 250);
    return () => clearTimeout(t);
  }, [search, picked]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    if (businessName.trim().length < 2) return setError("Enter the business name.");
    setBusy(true);
    setError(null);
    try {
      await admin.verify(picked.id, businessName);
      setList(await admin.listVerified());
      setPicked(null);
      setSearch("");
      setBusinessName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify.");
    }
    setBusy(false);
  }

  async function remove(b: admin.VerifiedBusiness) {
    if (!confirm(`Un-verify ${b.businessName}? They won't be able to post new events. Events already posted stay up.`)) return;
    try {
      await admin.unverify(b.userId);
      setList((l) => (l ?? []).filter((x) => x.userId !== b.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't un-verify.");
    }
  }

  return (
    <section className="card grid gap-3">
      <h2 className="text-lg font-bold">✅ Verified businesses</h2>
      <p className="text-sm text-muted">Only these accounts (and admins) can post events. Check a business is real before verifying it.</p>
      {list === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">No businesses verified yet.</p>
      ) : (
        list.map((b) => (
          <div key={b.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{b.businessName}</p>
              <p className="truncate text-xs text-muted">Account: {b.accountName} · since {new Date(b.verifiedAt).toLocaleDateString("en-GB")}</p>
            </div>
            <button onClick={() => remove(b)} className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-bad hover:bg-bad/10">Remove</button>
          </div>
        ))
      )}

      <form onSubmit={add} className="grid gap-3 border-t border-ink/10 pt-3">
        <p className="font-semibold">Verify a business</p>
        <p className="text-xs text-muted">The business makes a normal Wayfund account first. Then find it here by its display name.</p>
        {picked ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-soft p-3">
            <span className="truncate text-sm">Account: <b>{picked.name}</b> (joined {new Date(picked.joinedAt).toLocaleDateString("en-GB")})</span>
            <button type="button" onClick={() => setPicked(null)} className="text-sm font-semibold underline">Change</button>
          </div>
        ) : (
          <>
            <label className="label">Find account
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type their display name" />
            </label>
            {results.length > 0 && (
              <div className="grid gap-1">
                {results.map((p) => (
                  <button type="button" key={p.id} onClick={() => { setPicked(p); setBusinessName(p.name); }}
                    className="flex min-h-11 items-center justify-between rounded-xl bg-cream px-3 text-left text-sm">
                    <b className="truncate">{p.name}</b>
                    <span className="shrink-0 text-xs text-muted">joined {new Date(p.joinedAt).toLocaleDateString("en-GB")}</span>
                  </button>
                ))}
              </div>
            )}
            {search.trim().length >= 2 && results.length === 0 && <p className="text-xs text-muted">No accounts match.</p>}
          </>
        )}
        {picked && (
          <>
            <label className="label">Business name (shown on their events)
              <input className="input" maxLength={60} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Lucky Hostel" />
            </label>
            <button className="btn" disabled={busy}>{busy ? "Verifying…" : "Verify business"}</button>
          </>
        )}
        {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
      </form>
    </section>
  );
}
