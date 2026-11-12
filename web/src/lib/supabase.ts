import { createClient } from "@supabase/supabase-js";

// Connection to Supabase, used for accounts (and later group chats and the
// Discover feed). Your private My Trip data is NOT stored here.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost", key ?? "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true },
});
