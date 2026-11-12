import { useEffect, useState } from "react";
import Sheet from "../../components/Sheet";
import { formatDate } from "../money";
import { WrongPassphraseError } from "../sync";
import { useSync } from "../SyncProvider";
import { getVaultInfo, type VaultInfo } from "../syncService";

// Settings for encrypted sync between your iPhone and laptop.

export default function SyncSettings() {
  const sync = useSync();
  const [sheet, setSheet] = useState(false);
  const [vault, setVault] = useState<VaultInfo | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sync.status === "off") getVaultInfo().then(setVault).catch(() => setVault(undefined));
  }, [sync.status]);

  if (sync.status === "unavailable") {
    return (
      <section className="card grid gap-2">
        <h2 className="text-xl font-extrabold">🔄 Sync between devices</h2>
        <p className="text-sm text-muted">Create an account to keep My Trip in sync between your phone and laptop. (Not available in the demo.)</p>
      </section>
    );
  }

  const when = sync.lastSyncedAt
    ? `${formatDate(sync.lastSyncedAt.slice(0, 10))} at ${new Date(sync.lastSyncedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : "not yet";

  return (
    <section className="card grid gap-3">
      <h2 className="text-xl font-extrabold">🔄 Sync between devices</h2>
      <p className="text-sm text-muted">
        Keep My Trip the same on your iPhone and laptop. Everything is <b>encrypted on this device</b> with a passphrase only you
        know before it's uploaded, so not even the website can read it.
      </p>

      {sync.status === "off" ? (
        <>
          {vault && (
            <p className="rounded-2xl bg-brand-soft p-3 text-sm">
              You already sync from another device ({vault.device ?? "unknown"}, last on {formatDate(vault.updatedAt.slice(0, 10), "long")}).
              Enter the same passphrase to connect this one.
            </p>
          )}
          <button className="btn" onClick={() => setSheet(true)}>{vault ? "Connect this device" : "Turn on sync"}</button>
        </>
      ) : (
        <>
          <p className={`rounded-2xl p-3 text-sm font-semibold ${sync.status === "error" ? "bg-bad/10 text-bad" : "bg-good/10 text-good"}`}>
            {sync.status === "syncing" ? "🔄 Syncing…" : sync.status === "error" ? `⚠️ ${sync.error}` : `✓ Sync is on · last synced ${when}`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-soft" disabled={sync.status === "syncing"} onClick={() => void sync.syncNow()}>Sync now</button>
            <button className="btn-soft" onClick={async () => {
              if (!confirm("Stop syncing on this device? Your data stays here, and the synced copy stays for your other devices.")) return;
              await sync.disable();
              setMessage("Sync turned off on this device.");
            }}>Turn off here</button>
          </div>
          <button className="text-left text-sm font-semibold text-bad" onClick={async () => {
            if (!confirm("Delete the synced copy for ALL your devices? Each device keeps its own data, but they'll stop syncing.")) return;
            try { await sync.deleteCloudCopy(); setMessage("Synced copy deleted."); } catch (e) { setMessage(e instanceof Error ? e.message : "Couldn't delete."); }
          }}>Delete the synced copy</button>
        </>
      )}
      {message && <p className="text-sm font-semibold">{message}</p>}

      {sheet && (
        <PassphraseSheet
          existing={!!vault}
          onClose={() => setSheet(false)}
          onSubmit={async (passphrase) => {
            const outcome = await sync.enable(passphrase);
            setSheet(false);
            setMessage(outcome === "created"
              ? "Sync is on ✓ Now open Wayfund on your other device, go to My Trip → Settings and enter the same passphrase."
              : "Connected ✓ This device now has your synced data.");
          }}
        />
      )}
    </section>
  );
}

function PassphraseSheet({ existing, onClose, onSubmit }: { existing: boolean; onClose: () => void; onSubmit: (p: string) => Promise<void> }) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!existing) {
      if (first.length < 10) return setError("Use at least 10 characters. A few random words works well, e.g. \"purple tram mango river\".");
      if (first !== second) return setError("The two passphrases don't match.");
      if (!understood) return setError("Please tick the box to confirm you understand.");
    }
    setBusy(true);
    try {
      await onSubmit(first);
    } catch (e) {
      setError(e instanceof WrongPassphraseError ? "That passphrase doesn't match your synced data. Check it and try again."
        : e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <h2 className="text-xl font-extrabold">{existing ? "Enter your sync passphrase" : "Choose a sync passphrase"}</h2>
        {!existing && (
          <p className="text-sm text-muted">
            This passphrase encrypts your data. It's different from your login password and is never sent anywhere.
            You'll type it once on each device.
          </p>
        )}
        <label className="label">Passphrase
          <input className="input" type="password" autoComplete={existing ? "current-password" : "new-password"} value={first} onChange={(e) => setFirst(e.target.value)} />
        </label>
        {!existing && (
          <>
            <label className="label">Type it again
              <input className="input" type="password" autoComplete="new-password" value={second} onChange={(e) => setSecond(e.target.value)} />
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>I understand that if I forget this passphrase, the synced copy can't be recovered by anyone. (Each device keeps its own copy, and backups still work.)</span>
            </label>
          </>
        )}
        {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
        <button className="btn" disabled={busy} onClick={submit}>
          {busy ? "Working… (this takes a few seconds)" : existing ? "Connect" : "Turn on sync"}
        </button>
      </div>
    </Sheet>
  );
}
