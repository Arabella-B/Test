import { blockGuest } from "../lib/demoRole";
import type { ChatMessage, Group, GroupsApi, NewGroup } from "./types";

// A pretend Groups service for the demo. Everything is made up, kept in memory
// only (it resets when you reload), and nothing is sent anywhere.
// Other "travellers" occasionally reply so you can see live chat working.

const ME = { id: "demo-me", name: "Alex (demo)" };
const PEOPLE: Record<string, string> = {
  "demo-sam": "Sam",
  "demo-priya": "Priya",
  "demo-tom": "Tom",
  "demo-leah": "Leah",
  "demo-kai": "Kai",
  "demo-hostel": "Lucky Hostel (business)",
};

const REPLIES = [
  "Sounds great! 🙌",
  "Ooh good shout, thanks!",
  "Anyone else heading that way next week?",
  "Top tip: download offline maps before you go 🗺️",
  "Ha, same 😅",
  "I'm in! Let's sort a time.",
];

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

interface DemoState {
  groups: (Omit<Group, "isMember" | "isOwner" | "memberCount"> & { members: Set<string> })[];
  messages: ChatMessage[];
  blocked: Set<string>;
}

let nextId = 1000;

function seed(): DemoState {
  const g = (id: string, emoji: string, name: string, purpose: string, tag: Group["tag"], createdBy: string, members: string[], ageMin: number) => ({
    id, emoji, name, purpose, tag, createdBy, createdAt: minutesAgo(ageMin), members: new Set(members),
  });
  const groups = [
    g("demo-g1", "🌏", "South-East Asia backpackers", "Swap tips, routes and hostel recommendations for Thailand, Vietnam, Cambodia and Laos.", "Destinations", "demo-sam", ["demo-sam", "demo-priya", "demo-tom", "demo-me"], 60 * 24 * 20),
    g("demo-g2", "💷", "Budget tips & hacks", "Saving money on the road: fee-free cards, cheap eats, free walking tours.", "Money & tips", "demo-priya", ["demo-priya", "demo-leah", "demo-me", "demo-kai"], 60 * 24 * 12),
    g("demo-g3", "🚆", "Interrail buddies", "Find people to share train journeys around Europe with.", "Travel buddies", "demo-tom", ["demo-tom", "demo-leah"], 60 * 24 * 8),
    g("demo-g4", "🏔️", "South America trekkers", "Altitude, treks, buses and border crossings in Peru, Bolivia and beyond.", "Destinations", "demo-kai", ["demo-kai", "demo-sam"], 60 * 24 * 5),
    g("demo-g5", "🎉", "Hostel events this week", "Quiz nights, pub crawls and free dinners posted by hostels.", "Events", "demo-hostel", ["demo-hostel", "demo-priya", "demo-tom", "demo-sam", "demo-leah"], 60 * 24 * 2),
    g("demo-g6", "🥾", "New Zealand campervan crew", "Share campsites, routes and campervan relocation deals.", "Travel buddies", "demo-leah", ["demo-leah"], 60 * 10),
  ];
  const m = (groupId: string, userId: string, body: string, ago: number): ChatMessage => ({
    id: String(nextId++), groupId, userId, authorName: userId === ME.id ? ME.name : PEOPLE[userId], body, createdAt: minutesAgo(ago),
  });
  const messages = [
    m("demo-g1", "demo-sam", "Welcome everyone! Where's everyone heading first? 🌴", 60 * 30),
    m("demo-g1", "demo-priya", "Bangkok → Chiang Mai → Pai, then over to Laos on the slow boat.", 60 * 29),
    m("demo-g1", "demo-tom", "Pai is amazing. Rent a scooter only if you're insured for it though!", 60 * 28),
    m("demo-g1", "demo-me", "Heading to Hanoi next week, any hostel tips?", 60 * 3),
    m("demo-g1", "demo-sam", "The Old Quarter is the place to be. Book a few nights ahead at weekends.", 60 * 2),
    m("demo-g1", "demo-priya", "Yes! And try the egg coffee ☕", 25),
    m("demo-g2", "demo-priya", "PSA: my high-street card charged me ~3% on every payment abroad. Get a fee-free card before you go!", 60 * 50),
    m("demo-g2", "demo-leah", "Also, always choose to pay in the LOCAL currency on card machines.", 60 * 49),
    m("demo-g2", "demo-kai", "7-Eleven toasties are the best cheap breakfast in Thailand, change my mind 🥪", 60 * 5),
    m("demo-g3", "demo-tom", "Anyone doing Paris → Barcelona around March?", 60 * 70),
    m("demo-g5", "demo-hostel", "🎤 Quiz night Thursday 8pm, free entry, prizes for the top 3 teams!", 60 * 6),
  ];
  return { groups, messages, blocked: new Set() };
}

let state: DemoState | null = null;
const listeners = new Map<string, Set<{ onInsert(m: ChatMessage): void; onDelete(id: string): void }>>();

function db(): DemoState {
  return (state ??= seed());
}

function view(g: DemoState["groups"][number]): Group {
  const { members, ...rest } = g;
  return { ...rest, memberCount: members.size, isMember: members.has(ME.id), isOwner: g.createdBy === ME.id };
}

function emit(groupId: string, kind: "insert" | "delete", payload: ChatMessage | string) {
  for (const l of listeners.get(groupId) ?? []) {
    if (kind === "insert") l.onInsert(payload as ChatMessage); else l.onDelete(payload as string);
  }
}

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));

export function createDemoGroupsApi(): GroupsApi {
  return {
    me: ME,
    isDemo: true,
    async listGroups() { await wait(); return db().groups.map(view).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async getGroup(id) { await wait(); const g = db().groups.find((x) => x.id === id); return g ? view(g) : null; },
    async createGroup(input: NewGroup) {
      blockGuest();
      await wait();
      const g = { id: `demo-new-${nextId++}`, ...input, createdBy: ME.id, createdAt: new Date().toISOString(), members: new Set([ME.id]) };
      db().groups.push(g);
      return view(g);
    },
    async join(id) { blockGuest(); await wait(); db().groups.find((g) => g.id === id)?.members.add(ME.id); },
    async leave(id) { await wait(); db().groups.find((g) => g.id === id)?.members.delete(ME.id); },
    async listMessages(groupId) {
      await wait();
      const g = db().groups.find((x) => x.id === groupId);
      if (!g?.members.has(ME.id)) throw new Error("You need to join this group first.");
      return db().messages.filter((m) => m.groupId === groupId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async latestMessages(ids) {
      return db().messages.filter((m) => ids.includes(m.groupId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async sendMessage(groupId, body) {
      blockGuest();
      await wait(100);
      const msg: ChatMessage = { id: String(nextId++), groupId, userId: ME.id, authorName: ME.name, body: body.trim(), createdAt: new Date().toISOString() };
      db().messages.push(msg);
      // Someone in the group replies a moment later, to show live updates.
      const others = [...(db().groups.find((g) => g.id === groupId)?.members ?? [])].filter((id) => id !== ME.id && PEOPLE[id]);
      if (others.length) {
        setTimeout(() => {
          const who = others[Math.floor(Math.random() * others.length)];
          const reply: ChatMessage = {
            id: String(nextId++), groupId, userId: who, authorName: PEOPLE[who],
            body: REPLIES[Math.floor(Math.random() * REPLIES.length)], createdAt: new Date().toISOString(),
          };
          db().messages.push(reply);
          emit(groupId, "insert", reply);
        }, 1800);
      }
      return msg;
    },
    async deleteMessage(id) {
      const msg = db().messages.find((m) => m.id === id);
      db().messages = db().messages.filter((m) => m.id !== id);
      if (msg) emit(msg.groupId, "delete", id);
    },
    subscribe(groupId, handlers) {
      const set = listeners.get(groupId) ?? new Set();
      set.add(handlers);
      listeners.set(groupId, set);
      return () => { set.delete(handlers); };
    },
    async report() { blockGuest(); await wait(); },
    async listBlocked() { return [...db().blocked].map((id) => ({ id, name: PEOPLE[id] ?? "Traveller" })); },
    async block(id) { blockGuest(); db().blocked.add(id); },
    async unblock(id) { db().blocked.delete(id); },
  };
}

/** Demo admin tools: remove a chat message for everyone. */
export function demoRemoveMessage(id: string): void {
  const msg = db().messages.find((m) => m.id === id);
  db().messages = db().messages.filter((m) => m.id !== id);
  if (msg) emit(msg.groupId, "delete", id);
}

/** Demo admin tools: delete a group and its messages. */
export function demoDeleteGroup(id: string): void {
  db().groups = db().groups.filter((g) => g.id !== id);
  db().messages = db().messages.filter((m) => m.groupId !== id);
}

/** Demo admin tools: find a message, to make made-up reports. */
export function demoFindMessage(match: (m: ChatMessage) => boolean): (ChatMessage & { groupName: string }) | undefined {
  const m = db().messages.find(match);
  return m && { ...m, groupName: db().groups.find((g) => g.id === m.groupId)?.name ?? "" };
}

/** Demo admin tools: remove everything someone has said. */
export function demoRemoveMessagesBy(userId: string): void {
  for (const m of db().messages.filter((x) => x.userId === userId)) demoRemoveMessage(m.id);
}
