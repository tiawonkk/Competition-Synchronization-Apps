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

export type CloudProblem = "tables_missing" | "bad_key" | "db_error";

export async function fetchStatus(): Promise<{ mode: Exclude<CloudMode, "checking">; problem?: CloudProblem }> {
  const r = await call<{ enabled: boolean; mode: "supabase" | "memory" | "off"; problem?: CloudProblem }>("/api/store?status=1");
  if (!r.ok) return { mode: "off" };
  return r.data.enabled ? { mode: r.data.mode } : { mode: "off", problem: r.data.problem };
}

export const CLOUD_PROBLEM_TEXT: Record<CloudProblem, string> = {
  tables_missing: "Server cloud terhubung ke Supabase, tetapi tabelnya belum dibuat. Jalankan supabase/schema_cloud_sync.sql di SQL Editor.",
  bad_key: "Kunci Supabase di server ditolak. Periksa SUPABASE_SERVICE_ROLE_KEY dan NEXT_PUBLIC_SUPABASE_URL di Vercel, lalu Redeploy.",
  db_error: "Server cloud tidak bisa membaca database Supabase. Periksa pengaturan di Vercel.",
};

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
