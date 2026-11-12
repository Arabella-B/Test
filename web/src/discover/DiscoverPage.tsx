import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGroups } from "../groups/GroupsProvider";
import PostCard from "./PostCard";
import { usePosts } from "./PostsProvider";
import { COUNTRIES, type FeedFilter, type Post } from "./types";

// The Discover feed: a colourful grid of updates and events.

const PAGE = 24;
const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "✨ All" },
  { key: "updates", label: "📸 Updates" },
  { key: "events", label: "🎉 Upcoming events" },
];

export default function DiscoverPage() {
  const api = usePosts();
  const { blocked } = useGroups();
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [country, setCountry] = useState("");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPosts(null);
    setError(null);
    try {
      const page = await api.listPosts({ filter, country: country || undefined, offset: 0, limit: PAGE });
      setPosts(page);
      setMore(page.length === PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the feed.");
      setPosts([]);
    }
  }, [api, filter, country]);

  useEffect(() => { void load(); }, [load]);

  async function loadMore() {
    if (!posts) return;
    setLoadingMore(true);
    try {
      const page = await api.listPosts({ filter, country: country || undefined, offset: posts.length, limit: PAGE });
      setPosts([...posts, ...page.filter((p) => !posts.some((x) => x.id === p.id))]);
      setMore(page.length === PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more.");
    }
    setLoadingMore(false);
  }

  async function like(post: Post) {
    const liked = !post.likedByMe;
    // Update straight away, then save; undo if saving fails.
    const change = (p: Post): Post => (p.id === post.id ? { ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) } : p);
    setPosts((list) => list?.map(change) ?? list);
    try {
      await api.setLike(post.id, liked);
    } catch {
      setPosts((list) => list?.map((p) => (p.id === post.id ? post : p)) ?? list);
    }
  }

  const visible = (posts ?? []).filter((p) => !blocked.has(p.userId));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Discover</h1>
        <Link to="/post" className="btn px-4">+ Post</Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${filter === f.key ? "bg-ink text-white" : "bg-white ring-1 ring-black/5"}`}>
            {f.label}
          </button>
        ))}
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Filter by country"
          className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold ring-1 ring-black/5 ${country ? "bg-brand text-white" : "bg-white"}`}
        >
          <option value="">🌍 Any country</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && <p className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}

      {posts === null ? (
        <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
          {[220, 160, 260, 180, 240, 200].map((h, i) => (
            <div key={i} className="mb-3 animate-pulse rounded-3xl bg-white/70" style={{ height: h }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card text-center">
          <p className="text-4xl">{filter === "events" ? "🎉" : "📸"}</p>
          <p className="mt-2 font-bold">{filter === "events" ? "No upcoming events here yet" : "Nothing here yet"}</p>
          <p className="text-sm text-muted">Be the first to post something!</p>
          <Link to="/post" className="btn mt-3">+ Post</Link>
        </div>
      ) : (
        <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
          {visible.map((p) => <PostCard key={p.id} post={p} onLike={like} />)}
        </div>
      )}

      {more && (
        <button className="btn-soft" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button>
      )}
      {api.isDemo && <p className="text-center text-xs text-muted">Demo posts are made up and reset when you reload.</p>}
    </div>
  );
}
