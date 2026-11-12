// Shapes used by the Groups section.

export const GROUP_TAGS = ["Destinations", "Travel buddies", "Money & tips", "Events", "Other"] as const;
export type GroupTag = (typeof GROUP_TAGS)[number];

export interface Group {
  id: string;
  name: string;
  purpose: string;
  emoji: string;
  tag: GroupTag;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  isMember: boolean;
  isOwner: boolean;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string; // ISO date-time
}

export interface NewGroup {
  name: string;
  purpose: string;
  emoji: string;
  tag: GroupTag;
}

export const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment or hate",
  "Scam or fraud",
  "Sharing someone's private information",
  "Inappropriate or sexual content",
  "Something else",
] as const;

export interface ReportInput {
  messageId?: string;
  userId: string;
  groupId: string;
  reason: string;
  snapshot: string;
}

/**
 * Everything the Groups screens need. There are two versions:
 * the real one (Supabase) and a pretend one for the demo.
 */
export interface GroupsApi {
  me: { id: string; name: string };
  isDemo: boolean;
  listGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  createGroup(input: NewGroup): Promise<Group>;
  join(groupId: string): Promise<void>;
  leave(groupId: string): Promise<void>;
  listMessages(groupId: string): Promise<ChatMessage[]>;
  latestMessages(groupIds: string[]): Promise<ChatMessage[]>;
  sendMessage(groupId: string, body: string): Promise<ChatMessage>;
  deleteMessage(messageId: string): Promise<void>;
  /** Live updates. Returns a function that stops listening. */
  subscribe(groupId: string, handlers: { onInsert(m: ChatMessage): void; onDelete(id: string): void }): () => void;
  report(input: ReportInput): Promise<void>;
  listBlocked(): Promise<{ id: string; name: string }[]>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
}
