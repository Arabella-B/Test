import { useState, type FormEvent } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { Logo } from "../components/Logo";
import { BackgroundShapes } from "../layout/AppLayout";
import { useAuth } from "./AuthProvider";

// The page people see before signing in: what the app is, sign up / log in,
// and a button to try the demo without an account.

type Mode = "signin" | "signup";

export default function Welcome() {
  const { startDemo } = useAuth();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (mode === "signup" && !adult) {
      setMessage({ tone: "bad", text: "Wayfund is for people aged 18 and over." });
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin },
      });
      if (error) setMessage({ tone: "bad", text: error.message });
      else if (!data.session) setMessage({ tone: "good", text: "Check your email for a link to confirm your account, then log in." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ tone: "bad", text: error.message === "Invalid login credentials" ? "That email and password don't match." : error.message });
    }
    setBusy(false);
  }

  return (
    <div className="relative isolate min-h-dvh">
      <BackgroundShapes />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2 md:items-center md:py-20">
        <section>
          <div className="mb-6"><Logo size={44} /></div>
          <h1 className="text-5xl font-extrabold leading-[1.02] md:text-6xl">
            Plan it.<br />Budget it.<br /><span className="text-brand-strong">Share it.</span>
          </h1>
          <p className="mt-4 text-lg text-muted">Your gap year, sorted: money, plans and people in one place.</p>
          <ul className="mt-6 grid gap-3 text-lg">
            <li className="flex gap-3"><span>✨</span><span><b>Discover</b> what other travellers are up to, and events near you</span></li>
            <li className="flex gap-3"><span>💬</span><span><b>Groups</b> to chat, plan and find travel buddies</span></li>
            <li className="flex gap-3"><span>🔒</span><span><b>My Trip</b>: your money and plans, private to you, with tips made for you</span></li>
          </ul>
          <button className="btn-soft mt-6" onClick={startDemo}>👀 Try the demo, no account needed</button>
        </section>

        <section className="card">
          <div className="mb-5 grid grid-cols-2 rounded-2xl bg-brand-soft p-1">
            {(["signup", "signin"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setMessage(null); }}
                className={`min-h-11 rounded-xl font-semibold ${mode === m ? "bg-surface text-brand-strong shadow-sm" : "text-muted"}`}
              >
                {m === "signup" ? "Create account" : "Log in"}
              </button>
            ))}
          </div>

          {!supabaseConfigured && (
            <p className="mb-4 rounded-2xl bg-sun/20 p-3 text-sm">Accounts aren't set up on this copy yet. You can still try the demo.</p>
          )}

          <form onSubmit={submit} className="grid grid-cols-1 gap-4">
            {mode === "signup" && (
              <label className="label">Display name
                <input className="input" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="What other travellers will see" autoComplete="nickname" />
              </label>
            )}
            <label className="label">Email
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="label">Password
              <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </label>
            {mode === "signup" && (
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                <span>I'm 18 or over and I'll be kind to other travellers.</span>
              </label>
            )}
            {message && (
              <p className={`rounded-2xl p-3 text-sm ${message.tone === "good" ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}>{message.text}</p>
            )}
            <button className="btn" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}</button>
          </form>
          <p className="mt-4 text-center text-xs text-muted">
            Your bank statements and money data never leave your device.
          </p>
        </section>
      </div>
    </div>
  );
}
