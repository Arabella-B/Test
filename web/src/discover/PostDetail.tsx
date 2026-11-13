import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReportSheet from "../components/ReportSheet";
import Sheet from "../components/Sheet";
import { chatTime, useGroups } from "../groups/GroupsProvider";
import { useAuth } from "../auth/AuthProvider";
import SuspendSheet from "../admin/SuspendSheet";
import { usePosts } from "./PostsProvider";
import { eventTime, type Post } from "./types";

// One post, full size, with like, report, block and delete.

export default function PostDetail() {
  const { id = "" } = useParams();
  const api = usePosts();
  const { isAdmin } = useAuth();
  const { api: groupsApi, refreshBlocked } = useGroups();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPost(id).then(setPost).catch((e) => { setError(e.message); setPost(null); });
  }, [api, id]);

  if (post === undefined) return <div className="card text-center text-muted">Loading…</div>;
  if (post === null) {
    return (
      <div className="card text-center">
        <p className="font-bold">{error ?? "This post has been removed."}</p>
        <Link to="/discover" className="btn-soft mt-3">Back to Discover</Link>
      </div>
    );
  }

  const mine = post.userId === api.me.id;
  const isEvent = post.kind === "event";

  async function like() {
    if (!post) return;
    const liked = !post.likedByMe;
    setPost({ ...post, likedByMe: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    try { await api.setLike(post.id, liked); } catch (e) {
      setPost(post);
      if (e instanceof Error && e.message.startsWith("Guests")) setError(e.message);
    }
  }

  async function remove() {
    const question = post && post.userId !== api.me.id
      ? `Remove ${post.authorName}'s post for everyone? This can't be undone.`
      : "Delete this post? This can't be undone.";
    if (!post || !confirm(question)) return;
    try {
      await api.deletePost(post.id);
      navigate("/discover");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    }
  }

  async function block() {
    if (!post || !confirm(`Block ${post.authorName}? You won't see their posts or messages. You can unblock them in Profile.`)) return;
    setMenu(false);
    try {
      await groupsApi.block(post.userId);
      await refreshBlocked();
      navigate("/discover");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't block.");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/discover"))} className="flex min-h-11 items-center gap-1 font-semibold">← Back</button>
        <button onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-xl ring-1 ring-ink/10" aria-label="More options">⋯</button>
      </div>

      <article className="overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-ink/10">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.eventTitle ?? post.caption.slice(0, 80)} className="block max-h-[70dvh] w-full object-contain bg-ink/10" />
        ) : (
          <div className="flex min-h-56 items-center p-6 text-2xl font-extrabold leading-snug text-white" style={{ background: post.colour }}>
            {isEvent ? post.eventTitle : post.caption}
          </div>
        )}

        <div className="grid gap-3 p-5">
          {isEvent && (
            <div className="grid gap-2">
              <span className="w-fit rounded-full bg-sun px-2.5 py-1 text-xs font-extrabold text-[#1F1B2D]">🎉 EVENT</span>
              <h1 className="text-2xl font-extrabold leading-tight">{post.eventTitle}</h1>
              <div className="grid gap-1.5 rounded-2xl bg-cream p-4 text-sm">
                {post.startsAt && <p>📅 <b>{eventTime(post.startsAt)}</b></p>}
                {post.location && <p>📍 {post.location}</p>}
                {post.priceText && <p>💷 {post.priceText}</p>}
                {post.businessName && <p>🏢 Posted by <b>{post.businessName}</b> <span className="font-semibold text-good">✔︎ Verified business</span></p>}
              </div>
              {post.linkUrl && (
                <a href={post.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn">
                  More info / book ↗
                </a>
              )}
              {post.linkUrl && <p className="text-xs text-muted">Opens {new URL(post.linkUrl).hostname}, an outside website. Never share bank details unless you trust it.</p>}
            </div>
          )}

          {post.caption && (isEvent || post.imageUrl) && <p className="whitespace-pre-wrap">{post.caption}</p>}
          {(post.place || post.country) && <p className="text-sm text-muted">📍 {[post.place, post.country].filter(Boolean).join(", ")}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{post.authorName}</p>
              <p className="text-xs text-muted">{chatTime(post.createdAt, true)}</p>
            </div>
            <button onClick={like} aria-pressed={post.likedByMe}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 font-bold ${post.likedByMe ? "bg-coral/15 text-coral-strong" : "bg-cream"}`}>
              {post.likedByMe ? "❤️" : "🤍"} {post.likeCount}
            </button>
          </div>
          {error && <p className="rounded-xl bg-bad/10 p-2 text-sm font-semibold text-bad">{error}</p>}
        </div>
      </article>

      {menu && (
        <Sheet onClose={() => setMenu(false)}>
          <div className="grid gap-2">
            {mine ? (
              <button className="min-h-12 rounded-2xl font-semibold text-bad ring-1 ring-bad/30" onClick={remove}>🗑️ Delete post</button>
            ) : (
              <>
                <button className="btn-soft" onClick={() => { setMenu(false); setReporting(true); }}>🚩 Report post</button>
                <button className="btn-soft" onClick={block}>🚫 Block {post.authorName}</button>
                {isAdmin && (
                  <>
                    <button className="min-h-12 rounded-2xl font-semibold text-bad ring-1 ring-bad/30" onClick={remove}>🛡️ Remove post (admin)</button>
                    <button className="min-h-12 rounded-2xl font-semibold text-bad ring-1 ring-bad/30" onClick={() => { setMenu(false); setSuspending(true); }}>
                      ⛔ Suspend {post.authorName} (admin)
                    </button>
                  </>
                )}
              </>
            )}
            <button className="btn-soft" onClick={() => setMenu(false)}>Cancel</button>
          </div>
        </Sheet>
      )}

      {suspending && (
        <SuspendSheet userId={post.userId} name={post.authorName} onClose={() => setSuspending(false)} onDone={() => navigate("/discover")} />
      )}

      {reporting && (
        <ReportSheet
          what="post"
          preview={post.eventTitle ?? post.caption}
          authorName={post.authorName}
          onClose={() => setReporting(false)}
          onSubmit={(reason) => api.report({ postId: post.id, userId: post.userId, reason, snapshot: `${post.eventTitle ?? ""} ${post.caption}`.trim() })}
        />
      )}
    </div>
  );
}
