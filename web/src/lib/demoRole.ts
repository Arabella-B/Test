// Demo only: which kind of account you're viewing the app as.
// Real accounts never use this; their role comes from the database.

export type DemoRole = "guest" | "user" | "business" | "moderator" | "admin";

export const DEMO_ROLES: { id: DemoRole; label: string }[] = [
  { id: "guest", label: "Guest (look only)" },
  { id: "user", label: "Normal user" },
  { id: "business", label: "Verified business" },
  { id: "moderator", label: "Moderator" },
  { id: "admin", label: "Admin" },
];

const KEY = "gap-year-demo-role";

let active = false; // true while the demo is running (set by AuthProvider)

export function getDemoRole(): DemoRole {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v === "guest" || v === "business" || v === "moderator" || v === "admin") return v;
  } catch { /* ignore */ }
  return "user";
}

export function saveDemoRole(role: DemoRole): void {
  try { sessionStorage.setItem(KEY, role); } catch { /* still works for this visit */ }
}

export function setDemoActive(on: boolean): void { active = on; }

/** True when the demo is running (so admin tools use made-up data). */
export function isDemoMode(): boolean { return active; }

/** The made-up business name used in the demo's "Verified business" view. */
export const DEMO_BUSINESS = "Beachside Hostel";

/** The name demo events are posted under, or null if this demo view can't post events. */
export function demoEventName(): string | null {
  const role = getDemoRole();
  return role === "admin" ? "Wayfund team" : role === "business" ? DEMO_BUSINESS : null;
}

/** Guests can look around but not change anything. */
export function blockGuest(): void {
  if (active && getDemoRole() === "guest") throw new Error("Guests can only look around. Create a free account to join in.");
}
