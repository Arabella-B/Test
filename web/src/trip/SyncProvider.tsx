import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useTrip } from "./store";
import type { SyncSnapshot } from "./sync";
import { createVault, deleteVault, getVaultInfo, syncWithVault, unlockVault } from "./syncService";

// Runs encrypted sync in the background: when the app opens, ~15 seconds after you
// change something, and when you leave the app. Only for signed-in accounts.

interface SyncInfo {
  lastSyncedAt?: string;
  lastHash?: string;
}

export type SyncStatus = "unavailable" | "off" | "idle" | "syncing" | "error";

interface SyncValue {
  status: SyncStatus;
  lastSyncedAt?: string;
  error: string | null;
  /** Turn on sync with a passphrase (creates the synced copy, or connects to the existing one). */
  enable(passphrase: string): Promise<"created" | "connected">;
  syncNow(): Promise<void>;
  /** Stop syncing on this device (the synced copy stays for your other devices). */
  disable(): Promise<void>;
  /** Delete the synced copy for all devices, and stop syncing here. */
  deleteCloudCopy(): Promise<void>;
}

const SyncContext = createContext<SyncValue | null>(null);

/** A stable fingerprint of the data, to skip uploads when nothing changed. */
function fingerprint(s: SyncSnapshot): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(stable)
      : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]))
      : v;
  const sorted = { ...s, transactions: [...s.transactions].sort((a, b) => a.id.localeCompare(b.id)) };
  const text = JSON.stringify(stable(sorted));
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${h}`;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const trip = useTrip();
  const { db, ready, isDemo, snapshot, applySnapshot } = trip;
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [info, setInfo] = useState<SyncInfo>({});
  const [status, setStatus] = useState<SyncStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;

  const available = !!session && !isDemo;

  // Load this device's saved sync key (if sync is on here).
  useEffect(() => {
    if (!ready || !available) return;
    void (async () => {
      const k = await db.get<CryptoKey>("syncKey");
      const i = (await db.get<SyncInfo>("syncInfo")) ?? {};
      setKey(k ?? null);
      setInfo(i);
      setStatus(k ? "idle" : "off");
    })();
  }, [db, ready, available]);

  const run = useCallback(async (k: CryptoKey, force = false) => {
    if (running.current) return;
    const local = snapRef.current();
    const before = fingerprint(local);
    if (!force && info.lastHash === before && info.lastSyncedAt && Date.now() - Date.parse(info.lastSyncedAt) < 60_000) return;
    running.current = true;
    setStatus("syncing");
    setError(null);
    try {
      const merged = await syncWithVault(k, local);
      if (fingerprint(merged) !== before) await applySnapshot(merged);
      const next = { lastSyncedAt: new Date().toISOString(), lastHash: fingerprint(merged) };
      setInfo(next);
      await db.set("syncInfo", next);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
      setStatus(navigator.onLine === false ? "idle" : "error");
    } finally {
      running.current = false;
    }
  }, [applySnapshot, db, info]);

  // Sync when the app opens.
  const startedFor = useRef<CryptoKey | null>(null);
  useEffect(() => {
    if (key && startedFor.current !== key) {
      startedFor.current = key;
      void run(key, true);
    }
  }, [key, run]);

  // Sync ~15 seconds after a change.
  const current = useMemo(() => (key ? fingerprint(snapshot()) : ""), [key, snapshot]);
  useEffect(() => {
    if (!key || !current || current === info.lastHash) return;
    const t = setTimeout(() => void run(key), 15_000);
    return () => clearTimeout(t);
  }, [key, current, info.lastHash, run]);

  // Sync when you leave the app (switch apps or lock the phone).
  useEffect(() => {
    if (!key) return;
    const onHide = () => { if (document.hidden && fingerprint(snapRef.current()) !== info.lastHash) void run(key); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [key, info.lastHash, run]);

  const value: SyncValue = {
    status: available ? status : "unavailable",
    lastSyncedAt: info.lastSyncedAt,
    error,
    async enable(passphrase) {
      const existing = await getVaultInfo();
      let k: CryptoKey;
      let outcome: "created" | "connected";
      if (existing) {
        k = await unlockVault(passphrase, existing);
        outcome = "connected";
      } else {
        k = (await createVault(passphrase, snapRef.current())).key;
        outcome = "created";
      }
      await db.set("syncKey", k);
      setKey(k);
      setStatus("idle");
      return outcome;
    },
    async syncNow() {
      if (key) await run(key, true);
    },
    async disable() {
      await db.delete("syncKey");
      await db.delete("syncInfo");
      setKey(null);
      setInfo({});
      setStatus("off");
      startedFor.current = null;
    },
    async deleteCloudCopy() {
      await deleteVault();
      await value.disable();
    },
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used inside SyncProvider");
  return value;
}
