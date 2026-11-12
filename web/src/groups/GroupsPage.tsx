import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { chatTime, lastRead, useGroups } from "./GroupsProvider";
import NewGroupSheet from "./NewGroupSheet";
import { GROUP_TAGS, type ChatMessage, type Group } from "./types";

// The Groups home: your groups (with the latest message and unread count),
// and a list of every group to browse, search and join.

export default function GroupsPage() {
  const { api, blocked } = useGroups();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [latest, setLatest] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "find">("mine");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await api.listGroups();
      setGroups(all);
      setLatest(await api.latestMessages(all.filter((g) => g.isMember).map((g) => g.id)));
      setError(null);
      if (!all.some((g) => g.isMember)) setTab("find");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load groups.");
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const mine = useMemo(() => {
    const list = (groups ?? []).filter((g) => g.isMember).map((g) => {
      const msgs = latest.filter((m) => m.groupId === g.id && !blocked.has(m.userId));
      const read = lastRead(g.id);
      return {
        group: g,
        last: msgs[0],
        unread: msgs.filter((m) => m.userId !== api.me.id && m.createdAt > read).length,
      };
    });
    return list.sort((a, b) => (b.last?.createdAt ?? b.group.createdAt).localeCompare(a.last?.createdAt ?? a.group.createdAt));
  }, [groups, latest, blocked, api.me.id]);

  const found = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groups ?? [])
      .filter((g) => !tag || g.tag === tag)
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.purpose.toLowerCase().includes(q))
      .sort((a, b) => b.memberCount - a.memberCount);
  }, [groups, search, tag]);

  async function join(g: Group) {
    setBusy(g.id);
    try {
      await api.join(g.id);
      navigate(`/groups/${g.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join.");
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Groups</h1>
        <button className="btn px-4" onClick={() => setCreating(true)}>+ New group</button>
      </div>

      <div className="grid grid-cols-2 rounded-2xl bg-surface p-1 ring-1 ring-ink/10">
        {(["mine", "find"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`min-h-11 rounded-xl font-semibold ${tab === t ? "bg-brand text-white" : "text-muted"}`}>
            {t === "mine" ? `My groups${mine.length ? ` (${mine.length})` : ""}` : "Find groups"}
          </button>
        ))}
      </div>

      {error && <p className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
      {!groups && !error && <div className="card text-center text-muted">Loading groups…</div>}

      {groups && tab === "mine" && (
        mine.length === 0 ? (
          <div className="card text-center">
            <p className="text-4xl">💬</p>
            <p className="mt-2 font-bold">You haven't joined any groups yet</p>
            <button className="btn-soft mt-3" onClick={() => setTab("find")}>Find groups</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-ink/10">
            {mine.map(({ group: g, last, unread }) => (
              <Link key={g.id} to={`/groups/${g.id}`} className="flex items-center gap-3 border-b border-ink/10 px-4 py-3 last:border-0 active:bg-cream">
                <GroupEmoji emoji={g.emoji} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold">{g.name}</span>
                    {last && <span className="shrink-0 text-xs text-muted">{chatTime(last.createdAt)}</span>}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-muted">
                      {last ? `${last.userId === api.me.id ? "You" : last.authorName}: ${last.body}` : "No messages yet. Say hello!"}
                    </span>
                    {unread > 0 && (
                      <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-coral px-1.5 text-xs font-bold text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )
      )}

      {groups && tab === "find" && (
        <>
          <input className="input" type="search" placeholder="🔍 Search groups" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {["", ...GROUP_TAGS].map((t) => (
              <button key={t || "all"} onClick={() => setTag(t)}
                className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${tag === t ? "bg-ink text-cream" : "bg-surface ring-1 ring-ink/10"}`}>
                {t || "All"}
              </button>
            ))}
          </div>
          {found.length === 0 ? (
            <div className="card text-center">
              <p className="font-bold">No groups found</p>
              <p className="text-sm text-muted">Why not start one?</p>
              <button className="btn mt-3" onClick={() => setCreating(true)}>+ New group</button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {found.map((g) => (
                <div key={g.id} className="card flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <GroupEmoji emoji={g.emoji} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight">{g.name}</p>
                      <p className="text-xs text-muted">{g.tag} · {g.memberCount} member{g.memberCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  {g.purpose && <p className="text-sm text-ink/80">{g.purpose}</p>}
                  {g.isMember ? (
                    <Link to={`/groups/${g.id}`} className="btn-soft mt-auto">Open chat</Link>
                  ) : (
                    <button className="btn mt-auto" disabled={busy === g.id} onClick={() => join(g)}>
                      {busy === g.id ? "Joining…" : "Join"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-center text-xs text-muted">
        Be kind, keep personal details private, and report anything that worries you.
        {api.isDemo && " Demo groups are made up and reset when you reload."}
      </p>

      {creating && (
        <NewGroupSheet
          onClose={() => setCreating(false)}
          onCreated={(g) => { setCreating(false); navigate(`/groups/${g.id}`); }}
        />
      )}
    </div>
  );
}

export function GroupEmoji({ emoji, size = 48 }: { emoji: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-coral/20 to-brand/20"
      style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden>
      {emoji}
    </span>
  );
}
