"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyOps, diffRoom, fullOps, type Op } from "./cloud-ops";
import { cloudJoin, cloudPull, cloudPush, fetchStatus, type CloudError, type CloudMode, type CloudProblem } from "./cloud";
import { uid } from "./logic";
import type { AppData } from "./seed";
import type { Competition } from "./types";

const KEY = "cs-cloud-v1";
const PAGE = 500;

interface RoomMeta {
  code: string;
  seq: number; // last event of this room already seen on this device
}

export type JoinInfo = { ok: true; roomId: string; title: string; memberIds: string[] } | { ok: false; error: CloudError };

export interface CloudInfo {
  mode: CloudMode;
  /** Why cloud sync is off although the server is configured (for example the SQL was not run). */
  problem?: CloudProblem;
  /** The database's own error message, when the check failed. */
  detail?: string;
  status: "idle" | "syncing" | "error";
  rooms: number;
  /** Fetches a room by invite code, merges it into local state and starts syncing it. */
  joinByCode: (code: string) => Promise<JoinInfo>;
  /** Merges a room that arrived another way (an invite link) without talking to the server. */
  importRoom: (ops: Op[], roomId: string) => void;
}

function loadRooms(): Record<string, RoomMeta> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, RoomMeta>;
  } catch {
    return {};
  }
}

/**
 * Keeps this device's competitions in step with the cloud:
 *  - rooms this user leads are uploaded once, then every local change is pushed (debounced),
 *  - every few seconds the changes other devices made are pulled and merged,
 *  - a room joined by code is downloaded first.
 * Remote changes are applied to `prev` as well, so they are never pushed back.
 */
export function useCloud(data: AppData, me: string, applyRemote: (ops: Op[], roomId: string) => void): CloudInfo {
  const [mode, setMode] = useState<CloudMode>("checking");
  const [problem, setProblem] = useState<CloudProblem | undefined>();
  const [detail, setDetail] = useState<string | undefined>();
  const [status, setStatus] = useState<CloudInfo["status"]>("idle");
  const [rooms, setRooms] = useState(0);
  const clientId = useRef(uid("c"));
  const prev = useRef(data);
  const meta = useRef<Record<string, RoomMeta>>({});
  const queue = useRef<Record<string, Op[]>>({});
  const busy = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const on = mode === "supabase" || mode === "memory";

  const persist = useCallback(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(meta.current));
    } catch {
      /* storage unavailable: rooms are re-detected on the next load */
    }
    setRooms(Object.keys(meta.current).length);
  }, []);

  useEffect(() => {
    meta.current = loadRooms();
    setRooms(Object.keys(meta.current).length);
    fetchStatus().then((s) => {
      setMode(s.mode);
      setProblem(s.problem);
      setDetail(s.detail);
    });
  }, []);

  const flush = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setStatus("syncing");
    let failed = false;
    try {
      for (const roomId of Object.keys(queue.current)) {
        const room = meta.current[roomId];
        if (!room) {
          delete queue.current[roomId];
          continue;
        }
        while (queue.current[roomId]?.length) {
          const chunk = queue.current[roomId].slice(0, 200);
          const r = await cloudPush(room.code, roomId, clientId.current, chunk);
          if (!r.ok) {
            if (r.error === "code_taken") {
              // Another team already owns this code in the cloud: stop syncing this room rather than mixing two teams.
              delete meta.current[roomId];
              delete queue.current[roomId];
              persist();
            }
            failed = true;
            break;
          }
          if (r.data && typeof r.data.head === "number" && r.data.head > room.seq) {
            room.seq = r.data.head;
            persist();
          }
          queue.current[roomId] = queue.current[roomId].slice(chunk.length);
        }
        if (failed) break;
        delete queue.current[roomId];
      }
    } finally {
      busy.current = false;
      setStatus(failed ? "error" : "idle");
      if (again.current) {
        again.current = false;
        schedule();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 350);
  }, [flush]);

  // Local changes -> queue.
  useEffect(() => {
    const before = prev.current;
    prev.current = data;
    if (!on) return;
    let dirty = false;
    // A competition that disappeared locally (data wiped) is dropped from syncing, never deleted in the cloud.
    for (const id of Object.keys(meta.current)) {
      if (!data.competitions.some((c) => c.id === id)) {
        delete meta.current[id];
        delete queue.current[id];
        dirty = true;
      }
    }
    const fresh = new Set<string>();
    for (const c of data.competitions) {
      if (meta.current[c.id]) continue;
      const isMember = data.members.some((m) => m.competitionId === c.id && m.userId === me);
      if (!isMember) continue;
      const leads = data.members.some((m) => m.competitionId === c.id && m.userId === me && m.role === "leader");
      meta.current[c.id] = { code: c.inviteCode, seq: 0 };
      if (leads) {
        queue.current[c.id] = fullOps(data, c.id);
        fresh.add(c.id);
      }
      dirty = true;
    }
    for (const id of Object.keys(meta.current)) {
      if (fresh.has(id)) continue;
      const ops = diffRoom(before, data, id);
      if (ops.length) {
        queue.current[id] = [...(queue.current[id] ?? []), ...ops];
        dirty = true;
      }
    }
    if (dirty) {
      persist();
      schedule();
    }
  }, [data, on, me, persist, schedule]);

  // Other devices' changes -> local state.
  useEffect(() => {
    if (!on) return;
    let stopped = false;
    let running = false;
    const tick = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        if (Object.keys(queue.current).length) await flush();
        for (const [roomId, room] of Object.entries(meta.current)) {
          let more = true;
          while (more && !stopped) {
            const r = await cloudPull(room.code, room.seq);
            if (!r.ok) {
              if (r.error !== "not_found") setStatus("error"); // not_found: the first upload has not landed yet
              break;
            }
            const foreign = r.data.events.filter((e) => e.clientId !== clientId.current).flatMap((e) => e.ops);
            if (foreign.length) {
              prev.current = applyOps(prev.current, foreign, roomId);
              applyRemote(foreign, roomId);
            }
            room.seq = r.data.head;
            more = r.data.events.length >= PAGE;
          }
        }
        persist();
      } finally {
        running = false;
      }
    };
    const id = setInterval(tick, 4000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [on, flush, applyRemote, persist]);

  const importRoom = useCallback(
    (ops: Op[], roomId: string) => {
      prev.current = applyOps(prev.current, ops, roomId);
      applyRemote(ops, roomId);
      const compOp = [...ops].reverse().find((o) => o.k === "competition" && o.v);
      const comp = compOp?.v as unknown as Competition | undefined;
      if (comp && !meta.current[roomId]) {
        meta.current[roomId] = { code: comp.inviteCode, seq: 0 };
        persist();
      }
    },
    [applyRemote, persist],
  );

  const joinByCode = useCallback(
    async (raw: string): Promise<JoinInfo> => {
      const first = await cloudJoin(raw);
      if (!first.ok) return first;
      const roomId = first.data.roomId;
      const ops: Op[] = first.data.events.flatMap((e) => e.ops);
      let head = first.data.head;
      let more = first.data.events.length >= PAGE;
      while (more) {
        const next = await cloudPull(raw, head);
        if (!next.ok) return next;
        ops.push(...next.data.events.flatMap((e) => e.ops));
        head = next.data.head;
        more = next.data.events.length >= PAGE;
      }
      const compOp = [...ops].reverse().find((o) => o.k === "competition" && o.v);
      if (!compOp) return { ok: false, error: "not_found" };
      const comp = compOp.v as unknown as Competition;
      importRoom(ops, roomId);
      meta.current[roomId] = { code: comp.inviteCode, seq: head };
      persist();
      const ids = new Set<string>();
      for (const o of ops) {
        if (o.k !== "member") continue;
        const userId = o.id.split(":")[1];
        if (o.v) ids.add(userId);
        else ids.delete(userId);
      }
      return { ok: true, roomId, title: comp.title, memberIds: [...ids] };
    },
    [importRoom, persist],
  );

  return { mode, problem, detail, status, rooms, joinByCode, importRoom };
}
