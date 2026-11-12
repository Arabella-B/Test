import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { shrinkImage } from "../lib/images";
import { usePosts } from "./PostsProvider";
import { COUNTRIES, POST_COLOURS, type PostKind } from "./types";

// Share what you're up to, or advertise an event.
// Photos are shrunk on your device first, which also strips their hidden
// location data before anything is uploaded.

export default function NewPostPage() {
  const api = usePosts();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PostKind>("update");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [colour, setColour] = useState(POST_COLOURS[0]);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [country, setCountry] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [priceText, setPriceText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Free the preview image's memory when it changes or the page closes.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  async function choosePhoto(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose a photo.");
    setBusy("Preparing photo…");
    try {
      const { blob } = await shrinkImage(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("Couldn't read that photo. Try a different one.");
    }
    setBusy(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (kind === "update" && !photo && !caption.trim()) return setError("Add a photo or write something.");
    if (kind === "event") {
      if (eventTitle.trim().length < 3) return setError("Give your event a title.");
      if (!startsAt) return setError("When does the event start?");
      if (new Date(startsAt) < new Date()) return setError("The event start time is in the past.");
      if (linkUrl && !/^https:\/\/[^\s]+\.[^\s]+/.test(linkUrl.trim())) return setError("Links must start with https://");
    }
    setBusy("Posting…");
    try {
      const post = await api.createPost({
        kind, caption, place, country, colour, image: photo?.blob,
        eventTitle, startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        location, priceText, linkUrl, businessName,
      });
      navigate(`/discover/${post.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post.");
      setBusy(null);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-xl grid-cols-1 gap-4">
      <h1 className="text-3xl font-extrabold">New post</h1>

      <div className="grid grid-cols-2 rounded-2xl bg-white p-1 ring-1 ring-black/5">
        {(["update", "event"] as const).map((k) => (
          <button type="button" key={k} onClick={() => setKind(k)}
            className={`min-h-12 rounded-xl font-semibold ${kind === k ? "bg-brand text-white" : "text-muted"}`}>
            {k === "update" ? "📸 What I'm up to" : "🎉 Event"}
          </button>
        ))}
      </div>

      {/* Photo */}
      {photo ? (
        <div className="relative overflow-hidden rounded-3xl bg-black/5">
          <img src={photo.url} alt="Your photo" className="block max-h-96 w-full object-contain" />
          <button type="button" onClick={() => setPhoto(null)} className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold shadow">
            Remove
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileInput.current?.click()}
          className="grid min-h-40 place-items-center gap-1 rounded-3xl border-4 border-dashed border-brand/30 bg-white p-6 text-center">
          <span className="text-4xl">📷</span>
          <span className="font-bold">Add a photo</span>
          <span className="text-xs text-muted">{kind === "update" ? "Optional: you can post just text instead" : "Optional, but events with photos get noticed"}</span>
        </button>
      )}
      <input ref={fileInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void choosePhoto(f); e.target.value = ""; }} />

      {!photo && (
        <div>
          <p className="label mb-2">Background colour (without a photo)</p>
          <div className="flex flex-wrap gap-2">
            {POST_COLOURS.map((c) => (
              <button type="button" key={c} onClick={() => setColour(c)} aria-label={`Colour ${c}`}
                className={`h-10 w-10 rounded-full ${colour === c ? "ring-4 ring-ink/30 ring-offset-2" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </div>
      )}

      {kind === "event" && (
        <>
          <label className="label">Event name
            <input className="input" maxLength={100} value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="e.g. Rooftop quiz night" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">Starts
              <input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="label">Price
              <input className="input" maxLength={40} value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="e.g. Free, £10, 300 THB" />
            </label>
          </div>
          <label className="label">Where
            <input className="input" maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue and town" />
          </label>
          <label className="label">Link for info or booking (optional)
            <input className="input" type="url" inputMode="url" maxLength={300} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
          </label>
          <label className="label">Business name (if you're posting for one)
            <input className="input" maxLength={60} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Lucky Hostel" />
          </label>
        </>
      )}

      <label className="label">{kind === "event" ? "Description" : "Caption"}
        <textarea className="input min-h-28 py-3" maxLength={1000} value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder={kind === "event" ? "What's happening, who it's for, what to bring…" : "What are you up to?"} />
      </label>

      {kind === "update" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">Place (optional)
            <input className="input" maxLength={80} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Chiang Mai" />
          </label>
          <label className="label">Country (optional)
            <input className="input" list="countries" maxLength={60} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Start typing…" />
          </label>
        </div>
      )}
      {kind === "event" && (
        <label className="label">Country (helps people find it)
          <input className="input" list="countries" maxLength={60} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Start typing…" />
        </label>
      )}
      <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>

      <p className="rounded-2xl bg-brand-soft p-3 text-xs text-ink/80">
        🔒 Posts are visible to everyone with an account. Hidden location data is removed from photos automatically.
        For your safety, avoid sharing exactly where you're staying or your future travel dates.
      </p>

      {error && <p className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
      <button className="btn" disabled={!!busy}>{busy ?? (kind === "event" ? "Post event" : "Post")}</button>
    </form>
  );
}
