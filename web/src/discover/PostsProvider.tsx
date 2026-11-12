import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { createDemoPostsApi } from "./demoApi";
import { createSupabasePostsApi } from "./supabaseApi";
import type { PostsApi } from "./types";

// Picks the real or demo Discover service.

const PostsContext = createContext<PostsApi | null>(null);

export function PostsProvider({ children }: { children: ReactNode }) {
  const { session, displayName } = useAuth();
  const userId = session?.user.id;
  const api = useMemo(
    () => (userId ? createSupabasePostsApi({ id: userId, name: displayName }) : createDemoPostsApi()),
    // Rebuild only when the signed-in person changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayName deliberately left out
    [userId],
  );
  return <PostsContext.Provider value={api}>{children}</PostsContext.Provider>;
}

export function usePosts(): PostsApi {
  const api = useContext(PostsContext);
  if (!api) throw new Error("usePosts must be used inside PostsProvider");
  return api;
}
