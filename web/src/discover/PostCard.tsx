import { Link } from "react-router-dom";
import { eventTime, type Post } from "./types";

// One tile in the Discover grid. Photos keep their own shape, so the grid
// looks like a Pinterest board. Posts without a photo show their text on colour.

export default function PostCard({ post, onLike }: { post: Post; onLike: (post: Post) => void }) {
  const isEvent = post.kind === "event";
  return (
    <article className="mb-3 break-inside-avoid overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-ink/10">
      <Link to={`/discover/${post.id}`} className="block">
        <div className="relative">
          {post.imageUrl ? (
            <img src={post.imageUrl} alt={post.eventTitle ?? post.caption.slice(0, 80)} loading="lazy" className="block w-full" />
          ) : (
            <div className="flex min-h-40 items-center p-4 text-lg font-extrabold leading-snug text-white" style={{ background: post.colour }}>
              <span className="line-clamp-6">{isEvent ? post.eventTitle : post.caption}</span>
            </div>
          )}
          {isEvent && (
            <span className="absolute left-2 top-2 rounded-full bg-sun px-2.5 py-1 text-xs font-extrabold text-[#1F1B2D] shadow">🎉 EVENT</span>
          )}
        </div>
        <div className="grid gap-1 p-3">
          {isEvent ? (
            <>
              {post.imageUrl && <p className="font-bold leading-tight">{post.eventTitle}</p>}
              <p className="text-xs font-semibold text-brand">📅 {post.startsAt && eventTime(post.startsAt)}</p>
              {post.location && <p className="line-clamp-1 text-xs text-muted">📍 {post.location}</p>}
              {post.priceText && <p className="text-xs font-semibold">{post.priceText}</p>}
            </>
          ) : (
            post.imageUrl && post.caption && <p className="line-clamp-3 text-sm">{post.caption}</p>
          )}
          {!isEvent && (post.place || post.country) && (
            <p className="line-clamp-1 text-xs text-muted">📍 {[post.place, post.country].filter(Boolean).join(", ")}</p>
          )}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <span className="truncate text-xs font-semibold text-muted">{post.businessName ?? post.authorName}</span>
        <button
          onClick={() => onLike(post)}
          aria-label={post.likedByMe ? "Unlike" : "Like"}
          aria-pressed={post.likedByMe}
          className={`flex min-h-9 items-center gap-1 rounded-full px-2.5 text-sm font-bold ${post.likedByMe ? "bg-coral/15 text-coral" : "bg-cream text-muted"}`}
        >
          {post.likedByMe ? "❤️" : "🤍"} {post.likeCount}
        </button>
      </div>
    </article>
  );
}
