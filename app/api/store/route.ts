import { NextResponse, type NextRequest } from "next/server";
import { sanitizeOps, type Op } from "@/lib/cloud-ops";
import { getStore } from "@/lib/integrations/cloud-store";
import { normalizeInviteCode } from "@/lib/logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cloud rooms: the shared state of one competition, so a team can work from several devices.
 *
 *   GET  /api/store?status=1                 -> { enabled, mode }
 *   GET  /api/store?code=XXX-00&since=N      -> events after N (changes made by other devices)
 *   POST { op: "join", code }                -> the whole room, for a new member
 *   POST { op: "push", code, roomId, clientId, ops } -> publish changes (creates the room on the first push)
 *
 * The invite code is the key to a room: whoever holds it is a member of the team, exactly as with joining by code.
 * Accounts (passwords, sign-in emails) never travel here; see lib/cloud-ops.ts.
 */

// Best-effort throttle per server instance, so guessing codes is slow. Not a substitute for real authentication.
const hits = new Map<string, number[]>();
function throttled(ip: string, limit = 240): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Turns a database error into a short, non-sensitive reason the app can explain to the user. */
function classify(e: unknown): "tables_missing" | "bad_key" | "db_error" {
  const msg = String((e as Error)?.message ?? e).toLowerCase();
  if (msg.includes("cs_rooms") || msg.includes("cs_events") || msg.includes("schema cache") || msg.includes("does not exist")) return "tables_missing";
  if (msg.includes("api key") || msg.includes("jwt") || msg.includes("invalid") || msg.includes("unauthorized")) return "bad_key";
  return "db_error";
}
const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export async function GET(req: NextRequest) {
  const store = getStore();
  const url = req.nextUrl.searchParams;
  if (url.get("status")) {
    if (!store) return NextResponse.json({ enabled: false, mode: "off" });
    // "Configured" is not "ready": probe the tables so a missing SQL step is reported instead of failing silently later.
    try {
      await store.roomByCode("__health__");
      return NextResponse.json({ enabled: true, mode: store.mode });
    } catch (e) {
      return NextResponse.json({ enabled: false, mode: store.mode, problem: classify(e) });
    }
  }
  if (!store) return fail("off", 503);
  if (throttled(clientIp(req))) return fail("rate_limited", 429);

  const code = normalizeInviteCode(url.get("code") ?? "");
  const since = Math.max(0, Number(url.get("since") ?? 0) || 0);
  if (!code) return fail("not_found", 404);
  try {
    const room = await store.roomByCode(code);
    if (!room) return fail("not_found", 404);
    return NextResponse.json({ roomId: room.id, ...(await store.since(room.id, since)) });
  } catch {
    return fail("server_error", 500);
  }
}

export async function POST(req: NextRequest) {
  const store = getStore();
  if (!store) return fail("off", 503);
  if (throttled(clientIp(req))) return fail("rate_limited", 429);

  const body = (await req.json().catch(() => null)) as { op?: string; code?: string; roomId?: string; clientId?: string; ops?: unknown } | null;
  const code = normalizeInviteCode(body?.code ?? "");
  if (!body || !code) return fail("not_found", 404);

  try {
    const room = await store.roomByCode(code);

    if (body.op === "join") {
      if (!room) return fail("not_found", 404);
      return NextResponse.json({ roomId: room.id, ...(await store.since(room.id, 0)) });
    }

    if (body.op !== "push") return fail("bad_request", 400);
    const clientId = String(body.clientId ?? "").slice(0, 60);
    const roomId = String(body.roomId ?? "");
    if (!clientId || !roomId) return fail("bad_request", 400);

    if (!room) {
      // A room is born from a real competition: the first push must carry it, with this very code.
      const first = Array.isArray(body.ops) ? (body.ops as Op[]).find((o) => o?.k === "competition" && o.id === roomId) : undefined;
      const comp = first?.v as { inviteCode?: string } | undefined;
      if (!comp || normalizeInviteCode(comp.inviteCode ?? "") !== code) return fail("bad_request", 400);
      if ((await store.createRoom(roomId, code)) === "taken") return fail("code_taken", 409);
    } else if (room.id !== roomId) {
      return fail("code_taken", 409);
    }

    const ops = sanitizeOps(body.ops, roomId);
    if (!ops) return fail("bad_request", 400);
    const head = await store.append(roomId, clientId, ops);
    return NextResponse.json({ head });
  } catch {
    return fail("server_error", 500);
  }
}
