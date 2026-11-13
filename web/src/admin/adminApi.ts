import { supabase } from "../lib/supabase";

// Tools for Wayfund admins. The database only lets admins do these things,
// so even if someone opened this page without being an admin, nothing would work.

export interface Report {
  id: number;
  createdAt: string;
  reason: string;
  snapshot: string;
  reporterName: string;
  reportedUserId: string;
  reportedName: string;
  postId: string | null;
  messageId: number | null;
  groupId: string | null;
  groupName: string | null;
}

export interface VerifiedBusiness {
  userId: string;
  businessName: string;
  accountName: string;
  verifiedAt: string;
}

export interface Person {
  id: string;
  name: string;
  joinedAt: string;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) {
    console.error("Admin:", res.error.message);
    throw new Error("Something went wrong. Please try again.");
  }
  return res.data;
}

interface ReportRow {
  id: number;
  created_at: string;
  reason: string;
  message_snapshot: string | null;
  reported_user_id: string;
  post_id: string | null;
  message_id: number | null;
  group_id: string | null;
  reporter: { display_name: string } | null;
  reported: { display_name: string } | null;
  groups: { name: string } | null;
}

export async function listReports(): Promise<Report[]> {
  const rows = check(
    await supabase
      .from("reports")
      .select(
        "id, created_at, reason, message_snapshot, reported_user_id, post_id, message_id, group_id," +
          " reporter:profiles!reports_reporter_id_fkey(display_name)," +
          " reported:profiles!reports_reported_user_id_fkey(display_name)," +
          " groups(name)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ) as unknown as ReportRow[];
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    reason: r.reason,
    snapshot: r.message_snapshot ?? "",
    reporterName: r.reporter?.display_name ?? "Someone",
    reportedUserId: r.reported_user_id,
    reportedName: r.reported?.display_name ?? "Traveller",
    postId: r.post_id,
    messageId: r.message_id,
    groupId: r.group_id,
    groupName: r.groups?.name ?? null,
  }));
}

/** Mark a report as dealt with (removes it from the inbox). */
export async function dismissReport(id: number): Promise<void> {
  check(await supabase.from("reports").delete().eq("id", id));
}

/** Remove a reported chat message for everyone (works without being in the group, and without reading the chat). */
export async function removeMessage(id: number): Promise<void> {
  check(await supabase.rpc("admin_remove_message", { message_id: id }));
}

/** How many reports are waiting. */
export async function countReports(): Promise<number> {
  const { count, error } = await supabase.from("reports").select("id", { count: "exact", head: true });
  return error ? 0 : count ?? 0;
}

// ---- Suspensions ----

export interface Suspension {
  userId: string;
  name: string;
  reason: string;
  suspendedAt: string;
}

/** Suspend someone. Optionally also remove every post and chat message they've made. */
export async function suspend(userId: string, reason: string, removeEverything: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const res = await supabase.from("suspended_users").insert({ user_id: userId, reason: reason.trim().slice(0, 300), suspended_by: user?.id });
  if (res.error?.code === "23505") throw new Error("That account is already suspended.");
  if (res.error) {
    console.error("Admin:", res.error.message);
    throw new Error(/row-level security/.test(res.error.message) ? "Admins can't be suspended." : "Couldn't suspend. Please try again.");
  }
  if (removeEverything) {
    const paths = check(await supabase.rpc("admin_remove_all_content", { target: userId })) as string[] | null;
    if (paths?.length) await supabase.storage.from("post-images").remove(paths);
  }
}

export async function unsuspend(userId: string): Promise<void> {
  check(await supabase.from("suspended_users").delete().eq("user_id", userId));
}

export async function listSuspended(): Promise<Suspension[]> {
  const rows = check(
    await supabase.from("suspended_users").select("user_id, reason, suspended_at").order("suspended_at", { ascending: false }),
  ) as { user_id: string; reason: string; suspended_at: string }[];
  if (rows.length === 0) return [];
  const names = check(await supabase.from("profiles").select("id, display_name").in("id", rows.map((r) => r.user_id))) as { id: string; display_name: string }[];
  const byId = new Map(names.map((n) => [n.id, n.display_name]));
  return rows.map((r) => ({ userId: r.user_id, name: byId.get(r.user_id) ?? "Traveller", reason: r.reason, suspendedAt: r.suspended_at }));
}

/** Delete a whole group, with all its messages. */
export async function deleteGroup(id: string): Promise<void> {
  check(await supabase.from("groups").delete().eq("id", id));
}

/** Remove a post (and its photo) for everyone. */
export async function removePost(id: string): Promise<void> {
  const row = check(await supabase.from("posts").select("image_path").eq("id", id).maybeSingle()) as { image_path: string | null } | null;
  check(await supabase.from("posts").delete().eq("id", id));
  if (row?.image_path) await supabase.storage.from("post-images").remove([row.image_path]);
}

export async function listVerified(): Promise<VerifiedBusiness[]> {
  const rows = check(
    await supabase.from("verified_businesses").select("user_id, business_name, verified_at").order("business_name"),
  ) as { user_id: string; business_name: string; verified_at: string }[];
  if (rows.length === 0) return [];
  const names = check(
    await supabase.from("profiles").select("id, display_name").in("id", rows.map((r) => r.user_id)),
  ) as { id: string; display_name: string }[];
  const byId = new Map(names.map((n) => [n.id, n.display_name]));
  return rows.map((r) => ({
    userId: r.user_id,
    businessName: r.business_name,
    accountName: byId.get(r.user_id) ?? "Traveller",
    verifiedAt: r.verified_at,
  }));
}

/** Find accounts by display name, to verify one as a business. */
export async function findPeople(search: string): Promise<Person[]> {
  const q = search.trim().replace(/[%_,()]/g, "");
  if (q.length < 2) return [];
  const rows = check(
    await supabase.from("profiles").select("id, display_name, created_at").ilike("display_name", `%${q}%`).order("display_name").limit(20),
  ) as { id: string; display_name: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, name: r.display_name, joinedAt: r.created_at }));
}

export async function verify(userId: string, businessName: string): Promise<void> {
  const res = await supabase.from("verified_businesses").insert({ user_id: userId, business_name: businessName.trim() });
  if (res.error?.code === "23505") throw new Error("That account is already verified.");
  check(res);
}

export async function unverify(userId: string): Promise<void> {
  check(await supabase.from("verified_businesses").delete().eq("user_id", userId));
}
