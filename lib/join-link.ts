import type { Op } from "./cloud-ops";

/**
 * Invite links: `https://site/#join=CODE` (the code is enough when cloud sync is on) or
 * `https://site/#join=CODE&d=<snapshot>` (the competition travels inside the link, for when there is no cloud).
 * Everything sits after the `#`, so the browser never sends it to the server and no URL length limit applies.
 */

const PENDING = "cs-pending-join";

export interface PendingJoin {
  code: string;
  data?: string;
}

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** "z." = gzip, "r." = raw JSON (browsers without CompressionStream). */
export async function encodeSnapshot(ops: Op[]): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(ops));
  if (typeof CompressionStream === "undefined") return `r.${toB64Url(raw)}`;
  return `z.${toB64Url(await pipe(raw, new CompressionStream("gzip")))}`;
}

export async function decodeSnapshot(d: string): Promise<Op[] | null> {
  try {
    const bytes = fromB64Url(d.slice(2));
    const raw = d.startsWith("z.") ? await pipe(bytes, new DecompressionStream("gzip")) : bytes;
    const ops = JSON.parse(new TextDecoder().decode(raw)) as unknown;
    return Array.isArray(ops) ? (ops as Op[]) : null;
  } catch {
    return null;
  }
}

export async function buildJoinLink(origin: string, code: string, snapshot?: Op[]): Promise<string> {
  const base = `${origin}/#join=${encodeURIComponent(code)}`;
  return snapshot ? `${base}&d=${await encodeSnapshot(snapshot)}` : base;
}

/** Moves `#join=...` out of the address bar into sessionStorage, so it survives signing in or registering first. */
export function captureJoinHash(): void {
  try {
    if (!location.hash.startsWith("#join=")) return;
    const params = new URLSearchParams(location.hash.slice(1));
    const code = params.get("join");
    if (!code) return;
    sessionStorage.setItem(PENDING, JSON.stringify({ code, data: params.get("d") ?? undefined } satisfies PendingJoin));
    history.replaceState(null, "", location.pathname + location.search);
  } catch {
    /* storage or history unavailable: the user can still type the code */
  }
}

export function peekPendingJoin(): PendingJoin | null {
  try {
    const raw = sessionStorage.getItem(PENDING);
    return raw ? (JSON.parse(raw) as PendingJoin) : null;
  } catch {
    return null;
  }
}

export function takePendingJoin(): PendingJoin | null {
  const p = peekPendingJoin();
  try {
    sessionStorage.removeItem(PENDING);
  } catch {
    /* nothing to clean */
  }
  return p;
}
