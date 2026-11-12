import { useState, type FormEvent } from "react";
import { useGroups } from "./GroupsProvider";
import { GROUP_TAGS, type Group, type GroupTag } from "./types";

// Form to start a new group with a name, a purpose, an emoji and a type.

const EMOJIS = ["💬", "🌏", "🌍", "🌎", "✈️", "🚆", "🎒", "🏝️", "🏔️", "🥾", "🍜", "🎉", "💷", "📸", "🤿", "🧘"];

export default function NewGroupSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Group) => void }) {
  const { api } = useGroups();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [tag, setTag] = useState<GroupTag>("Destinations");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return setError("Give your group a name of at least 3 letters.");
    setBusy(true);
    try {
      onCreated(await api.createGroup({ name, purpose, emoji, tag }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the group.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="grid max-h-[90dvh] w-full max-w-lg gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-10 md:rounded-3xl md:pb-5"
        role="dialog"
        aria-label="New group"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">New group</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-cream" aria-label="Close">✕</button>
        </div>

        <div>
          <p className="label mb-2">Pick an emoji</p>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button type="button" key={e} onClick={() => setEmoji(e)} aria-label={`Emoji ${e}`}
                className={`grid h-11 w-11 place-items-center rounded-xl text-2xl ${emoji === e ? "bg-brand-soft ring-2 ring-brand-strong" : "bg-cream"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <label className="label">Group name
          <input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hanoi in March" />
        </label>
        <label className="label">What's it for?
          <textarea className="input min-h-24 py-3" maxLength={300} value={purpose} onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Meet up, share hostel tips and find people to explore with." />
        </label>
        <div>
          <p className="label mb-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {GROUP_TAGS.map((t) => (
              <button type="button" key={t} onClick={() => setTag(t)}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold ${tag === t ? "bg-coral text-on-coral" : "bg-cream"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">Anyone with an account can find and join your group. You can remove messages that break the rules.</p>
        {error && <p className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create group"}</button>
      </form>
    </div>
  );
}
