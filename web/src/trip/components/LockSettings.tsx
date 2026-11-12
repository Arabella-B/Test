import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import Sheet from "../../components/Sheet";
import { biometricsAvailable, checkPasscode, createLock, isValidPasscode, loadLock, registerBiometrics, saveLock, type LockConfig } from "../lock";
import { useTrip } from "../store";
import { markUnlocked, notifyLockChange, useTripLock } from "./LockScreen";

// Settings for the My Trip lock: set/change/remove a passcode, Face ID, auto-lock time.

const AUTO_LOCK: [number, string][] = [[0, "Straight away"], [1, "After 1 minute"], [5, "After 5 minutes"], [15, "After 15 minutes"]];

export default function LockSettings() {
  const { scope } = useTrip();
  const { displayName } = useAuth();
  const { lockNow } = useTripLock(scope);
  const [config, setConfig] = useState<LockConfig | null>(() => loadLock(scope));
  const [sheet, setSheet] = useState<"set" | "change" | "remove" | null>(null);
  const [canBio, setCanBio] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void biometricsAvailable().then(setCanBio); }, []);

  function save(next: LockConfig | null) {
    saveLock(scope, next);
    setConfig(next);
    // You've just proved you know the passcode, so stay unlocked until you leave.
    if (next) markUnlocked(scope);
    else notifyLockChange();
  }

  async function toggleBiometrics() {
    if (!config) return;
    if (config.credentialId) {
      save({ ...config, credentialId: undefined });
      return setMessage("Face ID / Touch ID turned off.");
    }
    try {
      const id = await registerBiometrics(displayName);
      save({ ...config, credentialId: id });
      setMessage("Face ID / Touch ID turned on ✓");
    } catch {
      setMessage("Face ID / Touch ID couldn't be set up on this device. Your passcode still works.");
    }
  }

  return (
    <section className="card grid gap-3">
      <h2 className="text-xl font-extrabold">🔐 Lock My Trip</h2>
      <p className="text-sm text-muted">
        Ask for a passcode (or Face ID) before showing your money and plans, for example if someone picks up your phone.
        It doesn't encrypt the data on this device, so keep your phone's own lock on too.
      </p>

      {!config ? (
        <button className="btn" onClick={() => setSheet("set")}>Set a passcode</button>
      ) : (
        <>
          <p className="rounded-2xl bg-good/10 p-3 text-sm font-semibold text-good">✓ My Trip is locked with a {config.length}-digit passcode{config.credentialId ? " and Face ID / Touch ID" : ""}.</p>
          <label className="label">Lock again
            <select className="input" value={config.autoLockMinutes} onChange={(e) => save({ ...config, autoLockMinutes: +e.target.value })}>
              {AUTO_LOCK.map(([m, label]) => <option key={m} value={m}>{label} when you leave the app</option>)}
            </select>
          </label>
          {canBio && (
            <button className="btn-soft" onClick={toggleBiometrics}>
              {config.credentialId ? "Turn off Face ID / Touch ID" : "🙂 Also unlock with Face ID / Touch ID"}
            </button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-soft px-2 text-sm" onClick={lockNow}>Lock now</button>
            <button className="btn-soft px-2 text-sm" onClick={() => setSheet("change")}>Change</button>
            <button className="min-h-12 rounded-2xl px-2 text-sm font-semibold text-bad ring-1 ring-bad/30" onClick={() => setSheet("remove")}>Remove</button>
          </div>
        </>
      )}
      {message && <p className="text-sm font-semibold">{message}</p>}

      {sheet && (
        <PasscodeSheet
          mode={sheet}
          config={config}
          onClose={() => setSheet(null)}
          onDone={(next, text) => { save(next); setSheet(null); setMessage(text); }}
        />
      )}
    </section>
  );
}

function PasscodeSheet({ mode, config, onClose, onDone }: {
  mode: "set" | "change" | "remove"; config: LockConfig | null;
  onClose: () => void; onDone: (next: LockConfig | null, message: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [error, setError] = useState<string | null>(null);
  const needsCurrent = mode !== "set";

  async function submit() {
    setError(null);
    if (needsCurrent && !(config && (await checkPasscode(config, current)))) return setError("Your current passcode isn't right.");
    if (mode === "remove") return onDone(null, "Lock removed.");
    if (!isValidPasscode(first)) return setError("Use 4 to 6 numbers.");
    if (first !== second) return setError("The two passcodes don't match.");
    const next = await createLock(first, config?.autoLockMinutes ?? 1);
    onDone({ ...next, credentialId: config?.credentialId }, mode === "set" ? "Passcode set ✓ My Trip will ask for it next time." : "Passcode changed ✓");
  }

  const pin = (value: string, set: (v: string) => void, label: string) => (
    <label className="label">{label}
      <input className="input text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" autoComplete="off"
        maxLength={6} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} />
    </label>
  );

  return (
    <Sheet onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <h2 className="text-xl font-extrabold">{mode === "set" ? "Set a passcode" : mode === "change" ? "Change passcode" : "Remove the lock"}</h2>
        {needsCurrent && pin(current, setCurrent, "Current passcode")}
        {mode !== "remove" && (
          <>
            {pin(first, setFirst, "New passcode (4–6 numbers)")}
            {pin(second, setSecond, "Type it again")}
          </>
        )}
        {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
        <button className="btn" onClick={submit}>{mode === "remove" ? "Remove lock" : "Save"}</button>
      </div>
    </Sheet>
  );
}
