import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { DEMO_BUSINESS, getDemoRole, saveDemoRole, setDemoActive, type DemoRole } from "../lib/demoRole";

// Keeps track of who is signed in. "Demo mode" lets anyone try the app with
// made-up data, without an account; it is remembered only for this browser tab.

interface AuthValue {
  loading: boolean;
  session: Session | null;
  demo: boolean;
  displayName: string;
  /** Wayfund admin (set only in the Supabase dashboard; in the demo, the "Admin" view). */
  isAdmin: boolean;
  /** Suspended by an admin: can look around but not post, message, like or join. */
  isSuspended: boolean;
  /** Moderator (appointed by an admin): can deal with reports. */
  isModerator: boolean;
  /** Your verified business name (you can post events), or null. */
  businessName: string | null;
  /** Demo "Guest" view: can look around but not change anything. */
  isGuest: boolean;
  /** Demo only: which kind of account you're viewing as. */
  demoRole: DemoRole;
  setDemoRole(role: DemoRole): void;
  startDemo(): void;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);
const DEMO_KEY = "gap-year-demo";

function readDemoFlag(): boolean {
  try { return sessionStorage.getItem(DEMO_KEY) === "1"; } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(readDemoFlag);
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [demoRole, setRole] = useState<DemoRole>(getDemoRole);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setDisplayName(""); setIsAdmin(false); setIsSuspended(false); setIsModerator(false); setBusinessName(null); return; }
    setDisplayName((session.user.user_metadata?.display_name as string) ?? "");
    supabase.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => { if (data?.display_name) setDisplayName(data.display_name); });
    // Only shows admin tools. The database itself decides what an admin may do.
    supabase.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data), () => setIsAdmin(false));
    supabase.from("suspended_users").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setIsSuspended(!!data), () => setIsSuspended(false));
    supabase.from("moderators").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setIsModerator(!!data), () => setIsModerator(false));
    supabase.from("verified_businesses").select("business_name").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setBusinessName(data?.business_name ?? null), () => setBusinessName(null));
  }, [session]);

  const inDemo = demo && !session;
  setDemoActive(inDemo); // lets the demo data know (admin tools, guest limits)

  const value: AuthValue = {
    loading,
    session,
    demo: inDemo,
    displayName: session
      ? displayName || "Traveller"
      : inDemo && demoRole === "guest" ? "Guest" : inDemo && demoRole === "business" ? DEMO_BUSINESS : "Alex (demo)",
    isAdmin: session ? isAdmin : inDemo && demoRole === "admin",
    isSuspended: !!session && isSuspended,
    isModerator: session ? isModerator && !isSuspended : inDemo && demoRole === "moderator",
    isGuest: inDemo && demoRole === "guest",
    businessName: session ? businessName : inDemo && demoRole === "business" ? DEMO_BUSINESS : null,
    demoRole,
    setDemoRole(role) { saveDemoRole(role); setRole(role); },
    startDemo() {
      try { sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* private mode: still works for this visit */ }
      setDemo(true);
    },
    async signOut() {
      try {
        sessionStorage.removeItem(DEMO_KEY);
        // Logging out removes the My Trip passcode lock, so a forgotten passcode
        // can be reset by logging back in (which needs your account password).
        localStorage.removeItem(`gap-year-lock-${session?.user.id ?? "demo"}`);
      } catch { /* ignore */ }
      setDemo(false);
      await supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
