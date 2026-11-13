// Demo only: which kind of account you're viewing the app as.
// Real accounts never use this; their role comes from the database.

export type DemoRole = "guest" | "user" | "moderator" | "admin";

export const DEMO_ROLES: { id: DemoRole; label: string }[] = [
  { id: "guest", label: "Guest (look only)" },
  { id: "user", label: "Normal user" },
  { id: "moderator", label: "Moderator" },
  { id: "admin", label: "Admin" },
];

const KEY = "gap-year-demo-role";

let active = false; // true while the demo is running (set by AuthProvider)

export function getDemoRole(): DemoRole {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v === "guest" || v === "moderator" || v === "admin") return v;
  } catch { /* ignore */ }
  return "user";
}

export function saveDemoRole(role: DemoRole): void {
  try { sessionStorage.setItem(KEY, role); } catch { /* still works for this visit */ }
}

export function setDemoActive(on: boolean): void { active = on; }

/** True when the demo is running (so admin tools use made-up data). */
export function isDemoMode(): boolean { return active; }

/** Guests can look around but not change anything. */
export function blockGuest(): void {
  if (active && getDemoRole() === "guest") throw new Error("Guests can only look around. Create a free account to join in.");
}
