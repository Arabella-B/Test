import { DEFAULT_CATEGORIES, getCategory } from "../categories";

// A small coloured badge showing a category's emoji and name.
export function CategoryBadge({ id, small = false }: { id: string; small?: boolean }) {
  const c = getCategory(id);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${small ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}
      style={{ backgroundColor: c.colour + "22", color: darken(c.colour) }}
    >
      <span>{c.emoji}</span> {c.name}
    </span>
  );
}

/** A round icon in the category colour. */
export function CategoryIcon({ id, size = 44 }: { id: string; size?: number }) {
  const c = getCategory(id);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{ width: size, height: size, backgroundColor: c.colour + "26", fontSize: size * 0.5 }}
      aria-hidden
    >
      {c.emoji}
    </span>
  );
}

/** Darker version of a colour, for readable text on a pale background. */
function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.62).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

/** A sheet that slides up (phone) or pops up (laptop) to choose a category. */
export function CategoryPicker({
  current, onPick, onClose, title,
}: { current?: string; onPick: (id: string) => void; onClose: () => void; title: string }) {
  const groups = ["Everyday", "Travel", "Money in & other"] as const;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-10 md:rounded-3xl md:pb-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-cream text-lg" aria-label="Close">✕</button>
        </div>
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g}</h3>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_CATEGORIES.filter((c) => c.group === g).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPick(c.id)}
                  className={`flex min-h-12 items-center gap-2 rounded-2xl border-2 px-3 text-left text-sm font-semibold ${
                    current === c.id ? "border-brand" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.colour + "1F" }}
                >
                  <span className="text-lg">{c.emoji}</span> {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
