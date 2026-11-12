import { supabase } from "../lib/supabase";
import type { ChatMessage, Group, GroupTag, GroupsApi, NewGroup, ReportInput } from "./types";

// The real Groups service, using Supabase. Database security rules make sure
// only members can read or send messages, and people can only add or remove
// themselves (see the create_groups_chat migration).

interface GroupRow {
  id: string;
  name: string;
  purpose: string;
  emoji: string;
  tag: GroupTag;
  created_by: string;
  created_at: string;
  group_members: { count: number }[];
}

interface MessageRow {
  id: number;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string } | null;
}

const GROUP_FIELDS = "id,name,purpose,emoji,tag,created_by,created_at,group_members(count)";
const MESSAGE_FIELDS = "id,group_id,user_id,body,created_at,profiles(display_name)";

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(friendly(result.error.message));
  return result.data;
}

/** Turn database errors into plain English. */
function friendly(message: string): string {
  if (/too quickly|lot of groups/.test(message)) return message;
  if (/row-level security|permission/i.test(message)) return "You need to join this group first.";
  if (/check constraint/i.test(message)) return "That's too long or too short. Please check and try again.";
  if (/fetch|network/i.test(message)) return "No connection. Check your internet and try again.";
  return "Something went wrong. Please try again.";
}

export function createSupabaseGroupsApi(me: { id: string; name: string }): GroupsApi {
  const names = new Map<string, string>([[me.id, me.name]]);

  async function myGroupIds(): Promise<Set<string>> {
    const rows = check(await supabase.from("group_members").select("group_id").eq("user_id", me.id));
    return new Set((rows ?? []).map((r: { group_id: string }) => r.group_id));
  }

  function toGroup(row: GroupRow, mine: Set<string>): Group {
    return {
      id: row.id,
      name: row.name,
      purpose: row.purpose,
      emoji: row.emoji,
      tag: row.tag,
      createdBy: row.created_by,
      createdAt: row.created_at,
      memberCount: row.group_members?.[0]?.count ?? 0,
      isMember: mine.has(row.id),
      isOwner: row.created_by === me.id,
    };
  }

  function toMessage(row: MessageRow): ChatMessage {
    const authorName = row.profiles?.display_name ?? names.get(row.user_id) ?? "Traveller";
    names.set(row.user_id, authorName);
    return {
      id: String(row.id),
      groupId: row.group_id,
      userId: row.user_id,
      authorName,
      body: row.body,
      createdAt: row.created_at,
    };
  }

  async function nameFor(userId: string): Promise<string> {
    if (names.has(userId)) return names.get(userId)!;
    const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const name = data?.display_name ?? "Traveller";
    names.set(userId, name);
    return name;
  }

  return {
    me,
    isDemo: false,

    async listGroups() {
      const [rows, mine] = await Promise.all([
        supabase.from("groups").select(GROUP_FIELDS).order("created_at", { ascending: false }).limit(200).then(check),
        myGroupIds(),
      ]);
      return (rows as unknown as GroupRow[]).map((r) => toGroup(r, mine));
    },

    async getGroup(id) {
      const [row, mine] = await Promise.all([
        supabase.from("groups").select(GROUP_FIELDS).eq("id", id).maybeSingle().then(check),
        myGroupIds(),
      ]);
      return row ? toGroup(row as unknown as GroupRow, mine) : null;
    },

    async createGroup(input: NewGroup) {
      const row = check(
        await supabase
          .from("groups")
          .insert({ name: input.name.trim(), purpose: input.purpose.trim(), emoji: input.emoji, tag: input.tag })
          .select(GROUP_FIELDS)
          .single(),
      );
      return { ...toGroup(row as unknown as GroupRow, new Set([(row as unknown as GroupRow).id])), memberCount: 1 };
    },

    async join(groupId) {
      check(await supabase.from("group_members").insert({ group_id: groupId }));
    },

    async leave(groupId) {
      check(await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", me.id));
    },

    async listMessages(groupId) {
      const rows = check(
        await supabase.from("messages_chat").select(MESSAGE_FIELDS).eq("group_id", groupId)
          .order("created_at", { ascending: false }).limit(200),
      );
      return (rows as unknown as MessageRow[]).map(toMessage).reverse();
    },

    async latestMessages(groupIds) {
      if (groupIds.length === 0) return [];
      const rows = check(
        await supabase.from("messages_chat").select(MESSAGE_FIELDS).in("group_id", groupIds)
          .order("created_at", { ascending: false }).limit(300),
      );
      return (rows as unknown as MessageRow[]).map(toMessage);
    },

    async sendMessage(groupId, body) {
      const row = check(
        await supabase.from("messages_chat").insert({ group_id: groupId, body: body.trim() }).select(MESSAGE_FIELDS).single(),
      );
      return toMessage(row as unknown as MessageRow);
    },

    async deleteMessage(messageId) {
      check(await supabase.from("messages_chat").delete().eq("id", Number(messageId)));
    },

    subscribe(groupId, handlers) {
      const channel = supabase
        .channel(`group-${groupId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages_chat", filter: `group_id=eq.${groupId}` },
          async (payload) => {
            const row = payload.new as Omit<MessageRow, "profiles">;
            handlers.onInsert(toMessage({ ...row, profiles: { display_name: await nameFor(row.user_id) } }));
          },
        )
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages_chat" }, (payload) => {
          const id = (payload.old as { id?: number }).id;
          if (id !== undefined) handlers.onDelete(String(id));
        })
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    },

    async report(input: ReportInput) {
      check(
        await supabase.from("reports").insert({
          message_id: input.messageId ? Number(input.messageId) : null,
          reported_user_id: input.userId,
          group_id: input.groupId,
          reason: input.reason.slice(0, 500),
          message_snapshot: input.snapshot.slice(0, 2000),
        }),
      );
    },

    async listBlocked() {
      const rows = check(
        await supabase.from("blocks").select("blocked_id, profiles!blocks_blocked_id_fkey(display_name)").eq("blocker_id", me.id),
      );
      return (rows as unknown as { blocked_id: string; profiles: { display_name: string } | null }[]).map((r) => ({
        id: r.blocked_id,
        name: r.profiles?.display_name ?? "Traveller",
      }));
    },

    async block(userId) {
      check(await supabase.from("blocks").insert({ blocked_id: userId }));
    },

    async unblock(userId) {
      check(await supabase.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", userId));
    },
  };
}
