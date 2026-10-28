/**
 * Resumable, chunked upload engine. A file is cut into chunks that each fit under the host's request limit
 * (Vercel serverless: ~4.5 MB) and sent one by one straight to cloud storage, so file size is only limited by the
 * target. `send` is pluggable; progress and resume are handled here:
 *
 *   - Supabase Storage: resumable uploads over the TUS protocol, which require 6 MB chunks.
 *   - OneDrive Pro (Microsoft Graph): `createUploadSession`, then PUT each range; chunk sizes must be a multiple of 320 KiB.
 *
 * Only the simulated sender below is wired into the UI. The Graph helpers show where the real calls plug in once a
 * delegated Microsoft access token is available; they have not been run against a real tenant.
 */

const KIB = 1024;
const MIB = 1024 * KIB;

export type UploadTarget = "supabase" | "onedrive";

export const UPLOAD_TARGETS: Record<UploadTarget, { label: string; protocol: string; chunkSize: number }> = {
  supabase: { label: "Supabase Storage", protocol: "TUS resumable upload", chunkSize: 6 * MIB },
  onedrive: { label: "OneDrive Pro (@binus.ac.id)", protocol: "Microsoft Graph createUploadSession", chunkSize: 32 * 320 * KIB }, // 10 MiB
};

export type ChunkSender = (chunk: Blob, index: number, total: number, offset: number, signal: AbortSignal) => Promise<void>;

export const chunkCount = (size: number, chunkSize: number) => Math.max(1, Math.ceil(size / chunkSize));

/**
 * Sends chunks from `startIndex` onward. Returns how many chunks are fully done: `total` when finished, or the index
 * to resume from when `signal` aborts (the chunk in flight is not counted and is sent again on resume).
 */
export async function uploadInChunks(
  file: Blob,
  { chunkSize, startIndex = 0, send, onChunk, signal }: { chunkSize: number; startIndex?: number; send: ChunkSender; onChunk: (done: number, total: number) => void; signal: AbortSignal },
): Promise<number> {
  const total = chunkCount(file.size, chunkSize);
  for (let i = startIndex; i < total; i++) {
    if (signal.aborted) return i;
    const offset = i * chunkSize;
    try {
      await send(file.slice(offset, Math.min(file.size, offset + chunkSize)), i, total, offset, signal);
    } catch (e) {
      if (signal.aborted) return i;
      throw e;
    }
    onChunk(i + 1, total);
  }
  return total;
}

/** Simulated network: each chunk takes time proportional to its size, so progress bars behave like a real upload. */
export const simulatedSender: ChunkSender = (chunk, _i, _n, _o, signal) =>
  new Promise((resolve, reject) => {
    const ms = Math.min(400, Math.max(80, (chunk.size / (40 * MIB)) * 1000));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

// ---- Real OneDrive plug-in points (not wired to the UI, not tested against a tenant) ----

/** POST /me/drive/root:/{path}:/createUploadSession -> uploadUrl to PUT the ranges to. */
export async function createGraphUploadSession(accessToken: string, path: string): Promise<string> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(path)}:/createUploadSession`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
  });
  if (!res.ok) throw new Error(`createUploadSession gagal (${res.status})`);
  return ((await res.json()) as { uploadUrl: string }).uploadUrl;
}

export function graphSender(uploadUrl: string, fileSize: number): ChunkSender {
  return async (chunk, _i, _n, offset, signal) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${offset}-${offset + chunk.size - 1}/${fileSize}` },
      body: chunk,
      signal,
    });
    if (!res.ok && res.status !== 202) throw new Error(`Unggah potongan gagal (${res.status})`);
  };
}

export function fmtBytes(n: number): string {
  if (n >= 1024 * MIB) return `${(n / (1024 * MIB)).toFixed(1).replace(".", ",")} GB`;
  if (n >= MIB) return `${(n / MIB).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / KIB))} KB`;
}
