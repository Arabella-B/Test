import { DEMO_BUSINESS, blockGuest, demoEventName, getDemoRole } from "../lib/demoRole";
import type { NewPost, Post, PostsApi } from "./types";

// Pretend Discover feed for the demo: made-up posts with drawn "photos"
// (colourful pictures, not real photos). Kept in memory; resets on reload.

const ME = { id: "demo-me", name: "Alex (demo)" };

/** A colourful picture drawn in code, used instead of real photos in the demo. */
function picture(emoji: string, from: string, to: string, w: number, h: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${w * 0.78}" cy="${h * 0.22}" r="${w * 0.12}" fill="#fff" opacity=".35"/>
<text x="50%" y="58%" font-size="${w * 0.32}" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const inDays = (d: number, hour: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};

let nextId = 1;
const base = (p: Partial<Post> & Pick<Post, "kind" | "userId" | "authorName">): Post => ({
  id: `demo-post-${nextId++}`, caption: "", place: "", country: "", colour: "#7C3AED", createdAt: hoursAgo(1),
  likeCount: 0, likedByMe: false, ...p,
});

function seed(): Post[] {
  return [
    base({ kind: "update", userId: "demo-priya", authorName: "Priya", caption: "Sunrise from the viewpoint was worth the 5am alarm 🌅", place: "Pai", country: "Thailand", imageUrl: picture("🌅", "#FF9A8B", "#7C3AED", 600, 800), createdAt: hoursAgo(2), likeCount: 24 }),
    base({ kind: "event", userId: "demo-hostel", authorName: "Lucky Hostel", businessName: "Lucky Hostel", caption: "Teams of up to 6. Prizes for the top 3 and a free drink for everyone who comes!", eventTitle: "Rooftop quiz night 🎤", startsAt: inDays(2, 20), location: "Lucky Hostel rooftop bar, Bangkok", priceText: "Free", country: "Thailand", imageUrl: picture("🎤", "#FFB020", "#FF6B6B", 600, 600), createdAt: hoursAgo(5), likeCount: 12 }),
    base({ kind: "update", userId: "demo-tom", authorName: "Tom", caption: "Night train from Paris done ✅ Waking up to the Alps was unreal.", place: "Zürich", country: "Switzerland", imageUrl: picture("🚆", "#0EA5E9", "#1F1B2D", 600, 450), createdAt: hoursAgo(8), likeCount: 9 }),
    base({ kind: "update", userId: "demo-kai", authorName: "Kai", caption: "PSA: drink loads of water and take day 1 slowly at altitude. Felt rough but fine now!", place: "Cusco", country: "Peru", colour: "#16A34A", createdAt: hoursAgo(11), likeCount: 31 }),
    base({ kind: "update", userId: "demo-leah", authorName: "Leah", caption: "Campervan life 🚐 found a free campsite with this view", place: "Lake Tekapo", country: "New Zealand", imageUrl: picture("🏔️", "#22C55E", "#0EA5E9", 600, 900), createdAt: hoursAgo(20), likeCount: 40 }),
    base({ kind: "event", userId: "demo-tours", authorName: "Mekong Trails", businessName: "Mekong Trails", caption: "Small-group day trip with lunch, a boat ride and a local cooking demo. Hotel pick-up included.", eventTitle: "Mekong Delta day trip", startsAt: inDays(4, 7), location: "Pick-up from District 1, Ho Chi Minh City", priceText: "£28", linkUrl: "https://example.com", country: "Vietnam", imageUrl: picture("🛶", "#14B8A6", "#2563EB", 600, 750), createdAt: hoursAgo(26), likeCount: 7 }),
    base({ kind: "update", userId: "demo-sam", authorName: "Sam", caption: "Banh mi number 4 of the day. No regrets 🥖", place: "Hoi An", country: "Vietnam", imageUrl: picture("🥖", "#F97316", "#EAB308", 600, 600), createdAt: hoursAgo(30), likeCount: 18 }),
    base({ kind: "event", userId: "demo-walks", authorName: "Hanoi Free Walks", businessName: "Hanoi Free Walks", caption: "Two-hour walking tour of the Old Quarter with a local student guide. Bring water and comfy shoes!", eventTitle: "Old Quarter walking tour 🚶", startsAt: inDays(1, 10), location: "Hoan Kiem Lake, Hanoi", priceText: "Free (tip what you like)", country: "Vietnam", colour: "#DB2777", createdAt: hoursAgo(34), likeCount: 5 }),
    base({ kind: "update", userId: "demo-priya", authorName: "Priya", caption: "Learned to make green curry today 🍛 recipe in the Budget tips group!", place: "Chiang Mai", country: "Thailand", imageUrl: picture("🍛", "#16A34A", "#EAB308", 600, 800), createdAt: hoursAgo(50), likeCount: 22 }),
    base({ kind: "update", userId: "demo-tom", authorName: "Tom", caption: "Seat reservations on the fast trains sell out. Book a few days ahead!", place: "Barcelona", country: "Spain", colour: "#0EA5E9", createdAt: hoursAgo(60), likeCount: 15 }),
    base({ kind: "update", userId: "demo-leah", authorName: "Leah", caption: "Driving Christchurch → Queenstown next week. Ask in the New Zealand group if you want to share fuel!", place: "Christchurch", country: "New Zealand", imageUrl: picture("🚐", "#EAB308", "#22C55E", 600, 500), createdAt: hoursAgo(70), likeCount: 3 }),
    base({ kind: "update", userId: "demo-kai", authorName: "Kai", caption: "Salt flats made me feel like I was on another planet 🤯", place: "Uyuni", country: "Bolivia", imageUrl: picture("🧂", "#E0E7FF", "#A78BFA", 600, 700), createdAt: hoursAgo(90), likeCount: 52 }),
  ];
}

let posts: Post[] | null = null;
const all = () => (posts ??= seed());
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));

export function createDemoPostsApi(): PostsApi {
  return {
    me: ME,
    isDemo: true,
    async listPosts({ filter, country, offset, limit }) {
      await wait();
      let list = all();
      if (filter === "updates") list = list.filter((p) => p.kind === "update");
      if (filter === "events") list = list.filter((p) => p.kind === "event" && (p.startsAt ?? "") >= new Date().toISOString());
      if (country) list = list.filter((p) => p.country === country);
      list = filter === "events"
        ? [...list].sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
        : [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      // Hand out copies, so the screen and this pretend database never share (and double-change) the same object.
      return list.slice(offset, offset + limit).map((p) => ({ ...p }));
    },
    async getPost(id) { await wait(); const p = all().find((x) => x.id === id); return p ? { ...p } : null; },
    // In the demo, the Admin view posts events as "Wayfund team" and the Verified business view
    // as its business; other views can't post events.
    async getMyBusiness() { return demoEventName(); },
    async createPost(input: NewPost) {
      blockGuest();
      await wait(300);
      const business = demoEventName();
      if (input.kind === "event" && !business) throw new Error("Only verified businesses can post events.");
      const post: Post = {
        id: `demo-post-${nextId++}`, userId: ME.id, authorName: getDemoRole() === "business" ? DEMO_BUSINESS : ME.name, kind: input.kind, caption: input.caption.trim(),
        place: input.place.trim(), country: input.country.trim(), colour: input.colour,
        imageUrl: input.image ? URL.createObjectURL(input.image) : undefined,
        eventTitle: input.eventTitle, startsAt: input.startsAt, location: input.location, priceText: input.priceText,
        linkUrl: input.linkUrl, businessName: input.kind === "event" ? business ?? undefined : undefined, createdAt: new Date().toISOString(), likeCount: 0, likedByMe: false,
      };
      all().push(post);
      return { ...post };
    },
    async deletePost(id) { posts = all().filter((p) => p.id !== id); },
    async setLike(id, liked) {
      blockGuest();
      const p = all().find((x) => x.id === id);
      if (p && p.likedByMe !== liked) { p.likedByMe = liked; p.likeCount += liked ? 1 : -1; }
    },
    async report() { blockGuest(); await wait(); },
  };
}

/** Demo admin tools: remove a post. Returns false if it wasn't there. */
export function demoRemovePost(id: string): boolean {
  const before = all().length;
  posts = all().filter((p) => p.id !== id);
  return posts.length < before;
}

/** Demo admin tools: a post's author and text, to make made-up reports. */
export function demoFindPost(match: (p: Post) => boolean): Post | undefined {
  return all().find(match);
}
