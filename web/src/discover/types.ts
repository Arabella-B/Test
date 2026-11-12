// Shapes used by the Discover feed.

export type PostKind = "update" | "event";

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  kind: PostKind;
  caption: string;
  place: string;
  country: string;
  imageUrl?: string;
  colour: string; // background for posts without a photo
  eventTitle?: string;
  startsAt?: string; // ISO date-time
  location?: string;
  priceText?: string;
  linkUrl?: string;
  businessName?: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface NewPost {
  kind: PostKind;
  caption: string;
  place: string;
  country: string;
  image?: Blob;
  colour: string;
  eventTitle?: string;
  startsAt?: string;
  location?: string;
  priceText?: string;
  linkUrl?: string;
}

export type FeedFilter = "all" | "updates" | "events";

export interface PostsApi {
  me: { id: string; name: string };
  isDemo: boolean;
  /** A page of the feed, newest first (events: soonest first, upcoming only). */
  listPosts(options: { filter: FeedFilter; country?: string; offset: number; limit: number }): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  /** The name your events are posted under (your verified business, or "Wayfund team" for admins); null if you can't post events. */
  getMyBusiness(): Promise<string | null>;
  createPost(post: NewPost): Promise<Post>;
  deletePost(id: string): Promise<void>;
  setLike(id: string, liked: boolean): Promise<void>;
  report(input: { postId: string; userId: string; reason: string; snapshot: string }): Promise<void>;
}

export const POST_COLOURS = ["#7C3AED", "#FF6B6B", "#F97316", "#EAB308", "#16A34A", "#0EA5E9", "#DB2777", "#1F1B2D"];

export const COUNTRIES = [
  "Argentina", "Australia", "Austria", "Belgium", "Bolivia", "Brazil", "Cambodia", "Canada", "Chile", "China", "Colombia",
  "Costa Rica", "Croatia", "Czechia", "Denmark", "Ecuador", "Fiji", "France", "Germany", "Greece", "Hungary", "Iceland",
  "India", "Indonesia", "Ireland", "Italy", "Japan", "Laos", "Malaysia", "Mexico", "Morocco", "Nepal", "Netherlands",
  "New Zealand", "Norway", "Peru", "Philippines", "Poland", "Portugal", "Singapore", "South Africa", "South Korea", "Spain",
  "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Tanzania", "Thailand", "United Kingdom", "USA", "Vietnam",
];

/** "Thu 14 Nov, 20:00" */
export function eventTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}
