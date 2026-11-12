import { useCallback, useEffect, useState } from "react";
import { checkPasscode, loadLock, unlockWithBiometrics } from "../lock";

// Keeps track of whether My Trip is locked, and locks it again after the app
// has been in the background for the chosen time.

const unlocked = new Set<string>(); // scopes unlocked in this visit
let hiddenAt: number | null = null;
const listeners = new Set<() => void>();

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt === null) return;
    const away = (Date.now() - hiddenAt) / 60_000;
    hiddenAt = null;
    for (const scope of [...unlocked]) {
      const config = loadLock(scope);
      if (config && away >= config.autoLockMinutes) unlocked.delete(scope);
    }
    listeners.forEach((l) => l());
  });
}

export function notifyLockChange(): void {
  listeners.forEach((l) => l());
}

/** Mark a scope as unlocked for this visit (e.g. right after you set a passcode). */
export function markUnlocked(scope: string): void {
  unlocked.add(scope);
  notifyLockChange();
}

export function useTripLock(scope: string) {
  const [, rerender] = useState(0);
  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const config = loadLock(scope);
  const locked = !!config && !unlocked.has(scope);
  // Tell every part of the page (not just this one) that the lock changed.
  const unlock = useCallback(() => { unlocked.add(scope); notifyLockChange(); }, [scope]);
  const lockNow = useCallback(() => { unlocked.delete(scope); notifyLockChange(); }, [scope]);
  return { locked, config, unlock, lockNow };
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function LockScreen({ scope, onUnlock }: { scope: string; onUnlock: () => void }) {
  const config = loadLock(scope)!;
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [checking, setChecking] = useState(false);

  const tryBiometrics = useCallback(async () => {
    if (!config.credentialId) return;
    if (await unlockWithBiometrics(config.credentialId)) onUnlock();
    else setError("Face ID / Touch ID didn't work. Use your passcode.");
  }, [config.credentialId, onUnlock]);

  async function press(k: string) {
    if (checking || Date.now() < waitUntil) return;
    setError(null);
    if (k === "⌫") return setEntry((e) => e.slice(0, -1));
    if (!k) return;
    const next = (entry + k).slice(0, config.length);
    setEntry(next);
    if (next.length < config.length) return;
    setChecking(true);
    const ok = await checkPasscode(config, next);
    setChecking(false);
    if (ok) return onUnlock();
    const f = fails + 1;
    setFails(f);
    setEntry("");
    if (f >= 5) {
      setWaitUntil(Date.now() + 30_000);
      setFails(0);
      setError("Too many tries. Wait 30 seconds.");
    } else {
      setError("Wrong passcode.");
    }
  }

  return (
    <div className="mx-auto grid max-w-sm grid-cols-1 gap-5 py-6 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-4xl">🔒</div>
      <div>
        <h2 className="text-2xl font-extrabold">My Trip is locked</h2>
        <p className="text-sm text-muted">Enter your passcode{config.credentialId ? " or use Face ID / Touch ID" : ""}.</p>
      </div>
      <div className="flex justify-center gap-3" aria-label={`${entry.length} digits entered`}>
        {Array.from({ length: config.length }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < entry.length ? "bg-brand" : "bg-ink/15"}`} />
        ))}
      </div>
      {error && <p className="font-semibold text-bad">{error}</p>}
      <div className="mx-auto grid w-64 grid-cols-3 gap-3">
        {KEYS.map((k, i) => (
          <button key={i} onClick={() => press(k)} disabled={!k}
            className={`h-16 rounded-full text-2xl font-bold ${k ? "bg-surface ring-1 ring-ink/10 active:bg-brand-soft" : "invisible"}`}
            aria-label={k === "⌫" ? "Delete" : k}>
            {k}
          </button>
        ))}
      </div>
      {config.credentialId && <button onClick={tryBiometrics} className="btn-soft mx-auto w-64">🙂 Use Face ID / Touch ID</button>}
      <p className="text-xs text-muted">Forgot your passcode? Log out (Profile) and log back in: that removes the lock. Your data stays on this device.</p>
    </div>
  );
}
