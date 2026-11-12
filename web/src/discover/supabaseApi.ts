import { supabase } from "../lib/supabase";
import type { NewPost, Post, PostsApi } from "./types";

// The real Discover service, using Supabase. Photos live in a private storage
// bucket; the feed asks for short-lived links (valid 1 hour) to show them.

const BUCKET = "post-images";
// "profiles!posts_user_id_fkey" means "the post's author". It has to be named,
// because posts also link to profiles through likes (who liked it).
const FIELDS = "*, profiles!posts_user_id_fkey(display_name), post_likes(count)";

interface PostRow {
  id: string;
  user_id: string;
  kind: "update" | "event";
  caption: string;
  place: string;
  country: string;
  image_path: string | null;
  colour: string;
  event_title: string | null;
  starts_at: string | null;
  location: string | null;
  price_text: string | null;
  link_url: string | null;
  business_name: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
  post_likes: { count: number }[];
}

function friendly(message: string): string {
  console.error("Discover:", message); // the real error, for debugging
  if (/posted a lot/.test(message)) return message;
  if (/check constraint|violates/i.test(message)) return "Something in the form isn't quite right. Please check it and try again.";
  if (/fetch|network/i.test(message)) return "No connection. Check your internet and try again.";
  if (/exceeded|too large|payload/i.test(message)) return "That photo is too big. Please choose a smaller one.";
  return "Something went wrong. Please try again.";
}

export function createSupabasePostsApi(me: { id: string; name: string }): PostsApi {
  /** Turn database rows into posts, with photo links and whether you've liked each one. */
  async function hydrate(rows: PostRow[]): Promise<Post[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
    const [likes, signed] = await Promise.all([
      supabase.from("post_likes").select("post_id").eq("user_id", me.id).in("post_id", ids),
      paths.length ? supabase.storage.from(BUCKET).createSignedUrls(paths, 3600) : Promise.resolve({ data: [], error: null }),
    ]);
    const liked = new Set((likes.data ?? []).map((l: { post_id: string }) => l.post_id));
    const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      authorName: r.profiles?.display_name ?? "Traveller",
      kind: r.kind,
      caption: r.caption,
      place: r.place,
      country: r.country,
      imageUrl: r.image_path ? urls.get(r.image_path) ?? undefined : undefined,
      colour: r.colour,
      eventTitle: r.event_title ?? undefined,
      startsAt: r.starts_at ?? undefined,
      location: r.location ?? undefined,
      priceText: r.price_text ?? undefined,
      linkUrl: r.link_url ?? undefined,
      businessName: r.business_name ?? undefined,
      createdAt: r.created_at,
      likeCount: r.post_likes?.[0]?.count ?? 0,
      likedByMe: liked.has(r.id),
    }));
  }

  return {
    me,
    isDemo: false,

    async listPosts({ filter, country, offset, limit }) {
      let query = supabase.from("posts").select(FIELDS);
      if (filter === "updates") query = query.eq("kind", "update");
      if (filter === "events") query = query.eq("kind", "event").gte("starts_at", new Date().toISOString());
      if (country) query = query.eq("country", country);
      query = filter === "events" ? query.order("starts_at", { ascending: true }) : query.order("created_at", { ascending: false });
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) throw new Error(friendly(error.message));
      return hydrate(data as unknown as PostRow[]);
    },

    async getPost(id) {
      const { data, error } = await supabase.from("posts").select(FIELDS).eq("id", id).maybeSingle();
      if (error) throw new Error(friendly(error.message));
      return data ? (await hydrate([data as unknown as PostRow]))[0] : null;
    },

    async createPost(post: NewPost) {
      let imagePath: string | null = null;
      if (post.image) {
        imagePath = `${me.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(imagePath, post.image, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error(friendly(error.message));
      }
      const isEvent = post.kind === "event";
      const { data, error } = await supabase
        .from("posts")
        .insert({
          kind: post.kind,
          caption: post.caption.trim(),
          place: post.place.trim(),
          country: post.country.trim(),
          image_path: imagePath,
          colour: post.colour,
          event_title: isEvent ? post.eventTitle?.trim() || null : null,
          starts_at: isEvent ? post.startsAt || null : null,
          location: isEvent ? post.location?.trim() || null : null,
          price_text: isEvent ? post.priceText?.trim() || null : null,
          link_url: isEvent ? post.linkUrl?.trim() || null : null,
          business_name: isEvent ? post.businessName?.trim() || null : null,
        })
        .select(FIELDS)
        .single();
      if (error) {
        // Don't leave an orphaned photo behind if the post couldn't be saved.
        if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath]);
        throw new Error(friendly(error.message));
      }
      return (await hydrate([data as unknown as PostRow]))[0];
    },

    async deletePost(id) {
      const { data } = await supabase.from("posts").select("image_path").eq("id", id).maybeSingle();
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw new Error(friendly(error.message));
      if (data?.image_path) await supabase.storage.from(BUCKET).remove([data.image_path]);
    },

    async setLike(id, liked) {
      const { error } = liked
        ? await supabase.from("post_likes").insert({ post_id: id })
        : await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", me.id);
      if (error && !/duplicate/i.test(error.message)) throw new Error(friendly(error.message));
    },

    async report({ postId, userId, reason, snapshot }) {
      const { error } = await supabase.from("reports").insert({
        post_id: postId, reported_user_id: userId, reason: reason.slice(0, 500), message_snapshot: snapshot.slice(0, 2000),
      });
      if (error) throw new Error(friendly(error.message));
    },
  };
}
