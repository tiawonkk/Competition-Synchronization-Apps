import type { Op } from "../cloud-ops";
import { serviceClient } from "./supabase-server";

/** Server-side storage for cloud rooms. Server only: it uses the Supabase service role. */

export interface RoomEvent {
  seq: number;
  clientId: string;
  ops: Op[];
}

export interface CloudStore {
  mode: "supabase" | "memory";
  roomByCode(codeNorm: string): Promise<{ id: string } | null>;
  /** "taken" when the code already belongs to a different room. */
  createRoom(id: string, codeNorm: string): Promise<"created" | "taken">;
  append(roomId: string, clientId: string, ops: Op[]): Promise<number>;
  since(roomId: string, seq: number): Promise<{ events: RoomEvent[]; head: number }>;
}

const PAGE = 500;

// ---------- Supabase (tables cs_rooms and cs_events, see supabase/schema_cloud_sync.sql) ----------
function supabaseStore(): CloudStore {
  const db = serviceClient();
  return {
    mode: "supabase",
    async roomByCode(codeNorm) {
      const { data, error } = await db.from("cs_rooms").select("id").eq("code_norm", codeNorm).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id as string } : null;
    },
    async createRoom(id, codeNorm) {
      const { error } = await db.from("cs_rooms").insert({ id, code_norm: codeNorm });
      if (!error) return "created";
      if (error.code === "23505") {
        const again = await this.roomByCode(codeNorm);
        return again?.id === id ? "created" : "taken";
      }
      throw new Error(error.message);
    },
    async append(roomId, clientId, ops) {
      const { data, error } = await db.from("cs_events").insert({ room_id: roomId, client_id: clientId, ops }).select("seq").single();
      if (error) throw new Error(error.message);
      return Number(data.seq);
    },
    async since(roomId, seq) {
      const { data, error } = await db.from("cs_events").select("seq, client_id, ops").eq("room_id", roomId).gt("seq", seq).order("seq", { ascending: true }).limit(PAGE);
      if (error) throw new Error(error.message);
      const events = (data ?? []).map((r) => ({ seq: Number(r.seq), clientId: r.client_id as string, ops: r.ops as Op[] }));
      return { events, head: events.length ? events[events.length - 1].seq : seq };
    },
  };
}

// ---------- In-memory (local development only) ----------
// A serverless host starts many short-lived instances, each with its own memory, so this cannot be used in production.
interface Mem {
  rooms: Map<string, string>; // codeNorm -> room id
  events: Map<string, RoomEvent[]>;
}
function memoryStore(): CloudStore {
  const g = globalThis as unknown as { __csCloud?: Mem };
  const mem: Mem = (g.__csCloud ??= { rooms: new Map<string, string>(), events: new Map<string, RoomEvent[]>() });
  return {
    mode: "memory",
    async roomByCode(codeNorm) {
      const id = mem.rooms.get(codeNorm);
      return id ? { id } : null;
    },
    async createRoom(id, codeNorm) {
      const cur = mem.rooms.get(codeNorm);
      if (cur && cur !== id) return "taken";
      mem.rooms.set(codeNorm, id);
      if (!mem.events.has(id)) mem.events.set(id, []);
      return "created";
    },
    async append(roomId, clientId, ops) {
      const list = mem.events.get(roomId) ?? [];
      const seq = (list[list.length - 1]?.seq ?? 0) + 1;
      list.push({ seq, clientId, ops });
      mem.events.set(roomId, list);
      return seq;
    },
    async since(roomId, seq) {
      const events = (mem.events.get(roomId) ?? []).filter((e) => e.seq > seq).slice(0, PAGE);
      return { events, head: events.length ? events[events.length - 1].seq : seq };
    },
  };
}

/** Supabase when its keys are present; memory only off-Vercel (local dev); otherwise cloud sync is off. */
export function getStore(): CloudStore | null {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return supabaseStore();
  if (!process.env.VERCEL) return memoryStore();
  return null;
}
