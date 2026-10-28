import type { Op } from "./cloud-ops";

/** Browser-side calls to /api/store. */

export type CloudMode = "checking" | "off" | "supabase" | "memory";
export type CloudError = "not_found" | "code_taken" | "off" | "rate_limited" | "network" | "server_error" | "bad_request";

export interface RoomEvent {
  seq: number;
  clientId: string;
  ops: Op[];
}

export type CloudResult<T> = { ok: true; data: T } | { ok: false; error: CloudError };

async function call<T>(url: string, init?: RequestInit): Promise<CloudResult<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const json = (await res.json().catch(() => ({}))) as T & { error?: CloudError };
    if (!res.ok) return { ok: false, error: json.error ?? "server_error" };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchStatus(): Promise<Exclude<CloudMode, "checking">> {
  const r = await call<{ enabled: boolean; mode: "supabase" | "memory" | "off" }>("/api/store?status=1");
  return r.ok && r.data.enabled ? r.data.mode : "off";
}

const post = <T,>(body: object) => call<T>("/api/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const cloudJoin = (code: string) => post<{ roomId: string; events: RoomEvent[]; head: number }>({ op: "join", code });
export const cloudPull = (code: string, since: number) => call<{ roomId: string; events: RoomEvent[]; head: number }>(`/api/store?code=${encodeURIComponent(code)}&since=${since}`);
export const cloudPush = (code: string, roomId: string, clientId: string, ops: Op[]) => post<{ head: number }>({ op: "push", code, roomId, clientId, ops });

export const CLOUD_ERROR_TEXT: Record<CloudError, string> = {
  not_found: "Kode tidak ditemukan di cloud.",
  code_taken: "Kode undangan ini sudah dipakai lomba lain di cloud.",
  off: "Cloud belum aktif di server ini.",
  rate_limited: "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
  network: "Tidak bisa menghubungi server. Periksa koneksi Anda.",
  server_error: "Server cloud sedang bermasalah. Coba lagi nanti.",
  bad_request: "Permintaan ke cloud ditolak.",
};
