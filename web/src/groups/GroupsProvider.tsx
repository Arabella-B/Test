import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { createDemoGroupsApi } from "./demoApi";
import { createSupabaseGroupsApi } from "./supabaseApi";
import type { GroupsApi } from "./types";

// Picks the real or demo Groups service, and keeps your block list handy so
// blocked people's messages can be hidden everywhere.

interface GroupsContextValue {
  api: GroupsApi;
  blocked: Set<string>;
  refreshBlocked(): Promise<void>;
}

const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { session, displayName } = useAuth();
  const userId = session?.user.id;
  const api = useMemo(
    () => (userId ? createSupabaseGroupsApi({ id: userId, name: displayName }) : createDemoGroupsApi()),
    // Only rebuild when the signed-in person changes; their name is looked up as needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayName deliberately left out
    [userId],
  );
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  const refreshBlocked = useCallback(async () => {
    try {
      const list = await api.listBlocked();
      setBlocked(new Set(list.map((b) => b.id)));
    } catch {
      /* offline: keep the last list */
    }
  }, [api]);

  useEffect(() => { void refreshBlocked(); }, [refreshBlocked]);

  return <GroupsContext.Provider value={{ api, blocked, refreshBlocked }}>{children}</GroupsContext.Provider>;
}

export function useGroups(): GroupsContextValue {
  const value = useContext(GroupsContext);
  if (!value) throw new Error("useGroups must be used inside GroupsProvider");
  return value;
}

// ---- "Last read" markers, kept on this device, used for unread counts ----

const READ_KEY = "gap-year-group-read";

function readMarkers(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(READ_KEY) ?? "{}"); } catch { return {}; }
}

export function lastRead(groupId: string): string {
  return readMarkers()[groupId] ?? "";
}

export function markRead(groupId: string, at: string): void {
  try {
    const all = readMarkers();
    if (!all[groupId] || all[groupId] < at) {
      all[groupId] = at;
      localStorage.setItem(READ_KEY, JSON.stringify(all));
    }
  } catch { /* storage unavailable */ }
}

/** "14:05" today, "Yesterday", or "12 Nov". */
export function chatTime(iso: string, withTime = false): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = d.toDateString() === yesterday.toDateString() ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return withTime ? `${day} ${time}` : day;
}
