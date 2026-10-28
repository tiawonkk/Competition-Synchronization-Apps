/**
 * Cloud sync works on "rooms": one room per competition, holding everything the team shares (the competition, its
 * stages, milestones, tasks, files, whiteboard, evaluation, members and their public profiles).
 *
 * Devices exchange small operations ("put this task", "delete that note") instead of whole snapshots, so two people
 * editing different tasks do not overwrite each other. This module is pure and shared by the browser and the server.
 *
 * Never part of a room: accounts' passwords, salts, sign-in emails, and anything about other competitions.
 */
import type { AppData } from "./seed";
import type { Competition, Member, User } from "./types";

export type OpKind = "competition" | "stage" | "milestone" | "task" | "resource" | "whiteboard" | "evaluation" | "member" | "user";

/** One change. `v` absent means "delete". */
export interface Op {
  k: OpKind;
  id: string;
  v?: Record<string, unknown>;
}

export const OP_KINDS: OpKind[] = ["competition", "stage", "milestone", "task", "resource", "whiteboard", "evaluation", "member", "user"];

type Coll = "stages" | "milestones" | "tasks" | "resources" | "whiteboard" | "evaluations";
const COLLS: [OpKind, Coll][] = [
  ["stage", "stages"],
  ["milestone", "milestones"],
  ["task", "tasks"],
  ["resource", "resources"],
  ["whiteboard", "whiteboard"],
  ["evaluation", "evaluations"],
];

export const memberOpId = (competitionId: string, userId: string) => `${competitionId}:${userId}`;

const mask = (e?: string) => (e ? e.replace(/^(.).*(@.*)$/, "$1***$2") : undefined);

/** What teammates may see of an account: name, colour and masked calendar addresses (enough for the badges). */
export function publicUser(u: User): User {
  return { id: u.id, fullName: u.fullName, color: u.color, emailGoogle: mask(u.emailGoogle), emailMicrosoft: mask(u.emailMicrosoft) };
}

interface Entry {
  k: OpKind;
  id: string;
  src: object; // the object held in app state; compared by reference to detect change
}

function entries(d: AppData, roomId: string): Map<string, Entry> {
  const out = new Map<string, Entry>();
  const put = (k: OpKind, id: string, src: object) => out.set(`${k}|${id}`, { k, id, src });
  const comp = d.competitions.find((c) => c.id === roomId);
  if (comp) put("competition", comp.id, comp);
  for (const [k, coll] of COLLS) for (const x of d[coll] as { id: string; competitionId: string }[]) if (x.competitionId === roomId) put(k, x.id, x);
  for (const m of d.members) {
    if (m.competitionId !== roomId) continue;
    put("member", memberOpId(m.competitionId, m.userId), m);
    const u = d.users.find((x) => x.id === m.userId);
    if (u) put("user", u.id, u);
  }
  return out;
}

const toOp = (e: Entry): Op => ({ k: e.k, id: e.id, v: (e.k === "user" ? publicUser(e.src as User) : e.src) as unknown as Record<string, unknown> });

/** Everything in a room as puts: the first upload of a competition, or the snapshot inside an invite link. */
export function fullOps(d: AppData, roomId: string): Op[] {
  // The competition goes first: the server creates the room from that op.
  return [...entries(d, roomId).values()].sort((a, b) => Number(b.k === "competition") - Number(a.k === "competition")).map(toOp);
}

/** Changes between two states, for one room. Relies on state being immutable: unchanged entities keep their identity. */
export function diffRoom(prev: AppData, next: AppData, roomId: string): Op[] {
  const a = entries(prev, roomId);
  const b = entries(next, roomId);
  const ops: Op[] = [];
  for (const [key, e] of b) if (a.get(key)?.src !== e.src) ops.push(toOp(e));
  // Deletions are shared for work items only; accounts and the competition itself are never deleted remotely.
  for (const [key, e] of a) if (!b.has(key) && e.k !== "user" && e.k !== "competition") ops.push({ k: e.k, id: e.id });
  return ops;
}

function upsert<T>(arr: T[], idOf: (x: T) => string, id: string, v: T): T[] {
  const i = arr.findIndex((x) => idOf(x) === id);
  return i < 0 ? [...arr, v] : arr.map((x, j) => (j === i ? v : x));
}

function applyOp(s: AppData, op: Op, roomId: string): AppData {
  if (op.k === "competition") {
    const v = op.v as unknown as Competition | undefined;
    if (!v || op.id !== roomId || v.id !== roomId) return s;
    return { ...s, competitions: upsert(s.competitions, (c) => c.id, roomId, v) };
  }
  if (op.k === "member") {
    const v = op.v as unknown as Member | undefined;
    if (!v) {
      const [cid, uid] = op.id.split(":");
      if (cid !== roomId) return s;
      return { ...s, members: s.members.filter((m) => !(m.competitionId === cid && m.userId === uid)) };
    }
    if (v.competitionId !== roomId || op.id !== memberOpId(roomId, v.userId)) return s;
    const i = s.members.findIndex((m) => m.competitionId === roomId && m.userId === v.userId);
    return { ...s, members: i < 0 ? [...s.members, v] : s.members.map((m, j) => (j === i ? v : m)) };
  }
  if (op.k === "user") {
    const v = op.v as unknown as User | undefined;
    // A profile only fills in people this device does not know; it never overwrites a real local account.
    if (!v || v.id !== op.id || s.users.some((u) => u.id === op.id)) return s;
    return { ...s, users: [...s.users, v] };
  }
  const coll = COLLS.find(([k]) => k === op.k)?.[1];
  if (!coll) return s;
  const list = s[coll] as unknown as { id: string; competitionId: string }[];
  if (op.v === undefined) {
    const cur = list.find((x) => x.id === op.id);
    return cur && cur.competitionId === roomId ? { ...s, [coll]: list.filter((x) => x.id !== op.id) } : s;
  }
  const v = op.v as unknown as { id: string; competitionId: string };
  if (v.id !== op.id || v.competitionId !== roomId) return s;
  return { ...s, [coll]: upsert(list, (x) => x.id, op.id, v) };
}

/** Applies operations to a state. Ops that do not belong to `roomId` are ignored, so a bad room cannot touch another one. */
export function applyOps(state: AppData, ops: Op[], roomId: string): AppData {
  let s = state;
  for (const op of ops) s = applyOp(s, op, roomId);
  return s;
}

/** Server-side validation of a client's ops: shape, size and ownership. Returns null if anything is off. */
export function sanitizeOps(raw: unknown, roomId: string): Op[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 300) return null;
  const out: Op[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { k, id, v } = item as { k?: unknown; id?: unknown; v?: unknown };
    if (typeof k !== "string" || !OP_KINDS.includes(k as OpKind) || typeof id !== "string" || id.length < 1 || id.length > 160) return null;
    if (v !== undefined && (v === null || typeof v !== "object" || Array.isArray(v))) return null;
    const val = v as Record<string, unknown> | undefined;
    if (val && JSON.stringify(val).length > 150_000) return null;
    if (val) {
      if (k === "competition" && (id !== roomId || val.id !== roomId)) return null;
      if (k === "member" && (val.competitionId !== roomId || id !== memberOpId(roomId, String(val.userId)))) return null;
      if (k === "user") {
        // Whitelist: whatever a client sends, no credentials or sign-in emails are ever stored.
        out.push({ k: "user", id, v: { id, fullName: String(val.fullName ?? "").slice(0, 80), color: String(val.color ?? "#3B82F6").slice(0, 20), emailGoogle: val.emailGoogle ? String(val.emailGoogle).slice(0, 80) : undefined, emailMicrosoft: val.emailMicrosoft ? String(val.emailMicrosoft).slice(0, 80) : undefined } });
        continue;
      }
      if (!["competition", "member"].includes(k) && val.competitionId !== roomId) return null;
    }
    out.push({ k: k as OpKind, id, v: val });
  }
  return out;
}
