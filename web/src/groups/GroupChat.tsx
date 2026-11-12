import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReportSheet from "../components/ReportSheet";
import Sheet from "../components/Sheet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GroupEmoji } from "./GroupsPage";
import { chatTime, markRead, useGroups } from "./GroupsProvider";
import type { ChatMessage, Group } from "./types";

// One group's chat. New messages appear live. Tap a message to report it,
// block its author, or delete it (your own, or any if you created the group).

export default function GroupChat() {
  const { id = "" } = useParams();
  const { api, blocked, refreshBlocked } = useGroups();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Load the group, then its messages if you're a member.
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const g = await api.getGroup(id);
        if (cancelled) return;
        setGroup(g);
        if (!g?.isMember) return;
        const list = await api.listMessages(id);
        if (cancelled) return;
        setMessages(list);
        stop = api.subscribe(id, {
          onInsert: (m) => setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m])),
          onDelete: (mid) => setMessages((prev) => prev.filter((p) => p.id !== mid)),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load this group.");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [api, id, group?.isMember]);

  // Keep the newest message in view and remember what you've read.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    const last = messages[messages.length - 1];
    if (last) markRead(id, last.createdAt);
  }, [messages, id]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await api.sendMessage(id, body);
      setMessages((prev) => (prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]));
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.");
    }
    setSending(false);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends on a laptop; Shift+Enter makes a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(min-width: 768px)").matches) {
      e.preventDefault();
      void send();
    }
  }

  async function join() {
    try {
      await api.join(id);
      setGroup((g) => (g ? { ...g, isMember: true, memberCount: g.memberCount + 1 } : g));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join.");
    }
  }

  async function leave() {
    if (!confirm(`Leave ${group?.name}? You can join again any time.`)) return;
    await api.leave(id);
    navigate("/groups");
  }

  async function remove(m: ChatMessage) {
    setSelected(null);
    try {
      await api.deleteMessage(m.id);
      setMessages((prev) => prev.filter((p) => p.id !== m.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    }
  }

  async function block(m: ChatMessage) {
    setSelected(null);
    if (!confirm(`Block ${m.authorName}? You won't see their messages anywhere. You can unblock them in Profile.`)) return;
    try {
      await api.block(m.userId);
      await refreshBlocked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't block.");
    }
  }

  if (group === undefined && !error) return <div className="card text-center text-muted">Loading…</div>;
  if (group === null) {
    return (
      <div className="card text-center">
        <p className="font-bold">This group doesn't exist any more.</p>
        <Link to="/groups" className="btn-soft mt-3">Back to groups</Link>
      </div>
    );
  }

  const visible = messages.filter((m) => !blocked.has(m.userId));
  const hiddenCount = messages.length - visible.length;

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-col bg-cream md:static md:z-auto md:h-[calc(100dvh-8rem)] md:overflow-hidden md:rounded-3xl md:bg-white md:ring-1 md:ring-black/5">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-black/5 bg-white px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <Link to="/groups" className="grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-cream" aria-label="Back to groups">←</Link>
        {group && <GroupEmoji emoji={group.emoji} size={40} />}
        <button className="min-w-0 flex-1 text-left" onClick={() => setShowInfo((s) => !s)}>
          <span className="block truncate font-bold">{group?.name}</span>
          <span className="block text-xs text-muted">{group?.memberCount} member{group?.memberCount === 1 ? "" : "s"} · tap for info</span>
        </button>
        {group?.isMember && (
          <button onClick={leave} className="rounded-full px-3 py-2 text-sm font-semibold text-bad hover:bg-bad/10">Leave</button>
        )}
      </header>

      {showInfo && group && (
        <div className="border-b border-black/5 bg-white px-4 py-3 text-sm">
          <p className="font-semibold">{group.tag}</p>
          <p className="text-muted">{group.purpose || "No description."}</p>
          {group.isOwner && <p className="mt-1 text-xs text-brand">You created this group, so you can remove any message.</p>}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {!group?.isMember ? (
          <div className="mx-auto mt-6 max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
            <div className="mx-auto mb-2 w-fit"><GroupEmoji emoji={group?.emoji ?? "💬"} size={64} /></div>
            <p className="text-lg font-bold">{group?.name}</p>
            <p className="mt-1 text-sm text-muted">{group?.purpose}</p>
            <button className="btn mt-4 w-full" onClick={join}>Join to chat</button>
            <p className="mt-2 text-xs text-muted">Only members can read and send messages.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-10 text-center text-muted">No messages yet. Say hello! 👋</p>
        ) : (
          <div className="mx-auto grid max-w-2xl gap-1">
            {visible.map((m, i) => {
              const prev = visible[i - 1];
              const mine = m.userId === api.me.id;
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const showName = !mine && (newDay || prev?.userId !== m.userId);
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <p className="my-2 text-center text-xs font-semibold text-muted">{chatTime(m.createdAt).includes(":") ? "Today" : chatTime(m.createdAt)}</p>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"} ${showName ? "mt-2" : ""}`}>
                    <button
                      onClick={() => setSelected(m)}
                      className={`max-w-[80%] rounded-3xl px-4 py-2 text-left shadow-sm ${
                        mine ? "rounded-br-lg bg-brand text-white" : "rounded-bl-lg bg-white ring-1 ring-black/5"
                      }`}
                    >
                      {showName && <span className="block text-xs font-bold text-coral">{m.authorName}</span>}
                      <span className="block whitespace-pre-wrap break-words">{m.body}</span>
                      <span className={`block text-right text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                        {new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                  </div>
                </Fragment>
              );
            })}
            {hiddenCount > 0 && <p className="mt-2 text-center text-xs text-muted">{hiddenCount} message{hiddenCount === 1 ? "" : "s"} from people you blocked hidden.</p>}
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* Composer */}
      {group?.isMember && (
        <form onSubmit={send} className="border-t border-black/5 bg-white p-2">
          {error && <p className="mb-2 rounded-xl bg-bad/10 px-3 py-2 text-sm font-semibold text-bad">{error}</p>}
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              maxLength={2000}
              rows={1}
              placeholder="Message"
              aria-label="Message"
              className="input max-h-32 min-h-12 flex-1 resize-none py-3"
            />
            <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-xl text-white disabled:opacity-40"
              disabled={!text.trim() || sending} aria-label="Send">
              ➤
            </button>
          </div>
        </form>
      )}
      {!group?.isMember && error && <p className="bg-bad/10 p-3 text-center text-sm font-semibold text-bad">{error}</p>}

      {/* Message actions */}
      {selected && (
        <Sheet onClose={() => setSelected(null)}>
          <p className="mb-1 text-xs font-semibold text-muted">{selected.authorName} · {chatTime(selected.createdAt, true)}</p>
          <p className="mb-4 line-clamp-3 rounded-2xl bg-cream p-3 text-sm">{selected.body}</p>
          <div className="grid gap-2">
            <button className="btn-soft" onClick={() => { void navigator.clipboard?.writeText(selected.body); setSelected(null); }}>📋 Copy text</button>
            {selected.userId !== api.me.id && (
              <>
                <button className="btn-soft" onClick={() => { setReporting(selected); setSelected(null); }}>🚩 Report message</button>
                <button className="btn-soft" onClick={() => block(selected)}>🚫 Block {selected.authorName}</button>
              </>
            )}
            {(selected.userId === api.me.id || group?.isOwner) && (
              <button className="min-h-12 rounded-2xl font-semibold text-bad ring-1 ring-bad/30" onClick={() => remove(selected)}>🗑️ Delete message</button>
            )}
          </div>
        </Sheet>
      )}

      {reporting && (
        <ReportSheet
          what="message"
          preview={reporting.body}
          authorName={reporting.authorName}
          onClose={() => setReporting(null)}
          onSubmit={async (reason) => {
            await api.report({ messageId: reporting.id, userId: reporting.userId, groupId: id, reason, snapshot: reporting.body });
          }}
        />
      )}
    </div>
  );
}
