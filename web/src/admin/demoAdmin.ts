import { demoFindPost, demoRemovePost } from "../discover/demoApi";
import { demoDeleteGroup, demoFindMessage, demoRemoveMessage, demoRemoveMessagesBy } from "../groups/demoApi";
import type { Moderator, Person, Report, Suspension, VerifiedBusiness } from "./adminApi";

// Made-up admin and moderator data for the demo's Admin and Moderator views.
// Kept in memory only; resets when you reload. Nothing is sent anywhere.

const PEOPLE: Person[] = [
  { id: "demo-me", name: "Alex (demo)", joinedAt: "2026-09-01T10:00:00Z" },
  { id: "demo-sam", name: "Sam", joinedAt: "2026-08-12T10:00:00Z" },
  { id: "demo-priya", name: "Priya", joinedAt: "2026-08-20T10:00:00Z" },
  { id: "demo-tom", name: "Tom", joinedAt: "2026-09-03T10:00:00Z" },
  { id: "demo-leah", name: "Leah", joinedAt: "2026-09-15T10:00:00Z" },
  { id: "demo-kai", name: "Kai", joinedAt: "2026-10-02T10:00:00Z" },
  { id: "demo-hostel", name: "Lucky Hostel", joinedAt: "2026-07-30T10:00:00Z" },
  { id: "demo-tours", name: "Mekong Trails", joinedAt: "2026-08-05T10:00:00Z" },
  { id: "demo-walks", name: "Hanoi Free Walks", joinedAt: "2026-08-25T10:00:00Z" },
];
const nameOf = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? "Traveller";
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

interface State {
  reports: Report[];
  moderators: Moderator[];
  suspended: Suspension[];
  verified: VerifiedBusiness[];
}

let state: State | null = null;
let nextReport = 1;

function seed(): State {
  const reports: Report[] = [];
  const post = demoFindPost((p) => p.userId === "demo-tom" && p.caption.startsWith("Seat reservations"));
  if (post) {
    reports.push({
      id: nextReport++, createdAt: hoursAgo(3), reason: "Looks like an advert", snapshot: post.caption,
      reporterName: "Leah", reportedUserId: post.userId, reportedName: post.authorName,
      postId: post.id, messageId: null, groupId: null, groupName: null,
    });
  }
  const msg = demoFindMessage((m) => m.userId === "demo-kai");
  if (msg) {
    reports.push({
      id: nextReport++, createdAt: hoursAgo(5), reason: "Spam", snapshot: msg.body,
      reporterName: "Priya", reportedUserId: msg.userId, reportedName: msg.authorName,
      postId: null, messageId: Number(msg.id), groupId: msg.groupId, groupName: msg.groupName,
    });
  }
  return {
    reports,
    moderators: [{ userId: "demo-priya", name: "Priya", addedAt: hoursAgo(24 * 10) }],
    suspended: [],
    verified: [
      { userId: "demo-hostel", businessName: "Lucky Hostel", accountName: "Lucky Hostel", verifiedAt: hoursAgo(24 * 30) },
      { userId: "demo-tours", businessName: "Mekong Trails", accountName: "Mekong Trails", verifiedAt: hoursAgo(24 * 20) },
      { userId: "demo-walks", businessName: "Hanoi Free Walks", accountName: "Hanoi Free Walks", verifiedAt: hoursAgo(24 * 12) },
    ],
  };
}
const db = () => (state ??= seed());
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));

export const demoAdmin = {
  async listReports() { await wait(); return db().reports.map((r) => ({ ...r })); },
  async dismissReport(id: number) { db().reports = db().reports.filter((r) => r.id !== id); },
  async removeReportedMessage(id: number) { demoRemoveMessage(String(id)); },
  async removeReportedPost(id: string) { demoRemovePost(id); },
  async countReports() { return db().reports.length; },

  async listModerators() { await wait(); return db().moderators.map((m) => ({ ...m })); },
  async addModerator(userId: string) {
    if (db().moderators.some((m) => m.userId === userId)) throw new Error("That account is already a moderator.");
    db().moderators.push({ userId, name: nameOf(userId), addedAt: new Date().toISOString() });
  },
  async removeModerator(userId: string) { db().moderators = db().moderators.filter((m) => m.userId !== userId); },

  async suspend(userId: string, reason: string, removeEverything: boolean) {
    if (userId === "demo-me") throw new Error("Admins can't be suspended.");
    if (db().suspended.some((s) => s.userId === userId)) throw new Error("That account is already suspended.");
    db().suspended.unshift({ userId, name: nameOf(userId), reason: reason.trim(), suspendedAt: new Date().toISOString() });
    if (removeEverything) {
      while (demoFindPost((p) => p.userId === userId)) demoRemovePost(demoFindPost((p) => p.userId === userId)!.id);
      demoRemoveMessagesBy(userId);
    }
  },
  async unsuspend(userId: string) { db().suspended = db().suspended.filter((s) => s.userId !== userId); },
  async listSuspended() { await wait(); return db().suspended.map((s) => ({ ...s })); },

  async deleteGroup(id: string) { demoDeleteGroup(id); },

  async listVerified() { await wait(); return db().verified.map((v) => ({ ...v })); },
  async findPeople(search: string) {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return PEOPLE.filter((p) => p.name.toLowerCase().includes(q));
  },
  async verify(userId: string, businessName: string) {
    if (db().verified.some((v) => v.userId === userId)) throw new Error("That account is already verified.");
    db().verified.push({ userId, businessName: businessName.trim(), accountName: nameOf(userId), verifiedAt: new Date().toISOString() });
  },
  async unverify(userId: string) { db().verified = db().verified.filter((v) => v.userId !== userId); },
};
