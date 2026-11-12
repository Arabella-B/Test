import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

// Keeps track of who is signed in. "Demo mode" lets anyone try the app with
// made-up data, without an account; it is remembered only for this browser tab.

interface AuthValue {
  loading: boolean;
  session: Session | null;
  demo: boolean;
  displayName: string;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setDisplayName(""); return; }
    setDisplayName((session.user.user_metadata?.display_name as string) ?? "");
    supabase.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => { if (data?.display_name) setDisplayName(data.display_name); });
  }, [session]);

  const value: AuthValue = {
    loading,
    session,
    demo: demo && !session,
    displayName: session ? displayName || "Traveller" : "Alex (demo)",
    startDemo() {
      try { sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* private mode: still works for this visit */ }
      setDemo(true);
    },
    async signOut() {
      try { sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
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
