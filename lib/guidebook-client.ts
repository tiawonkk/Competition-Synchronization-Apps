import { extractPdfText, renderPdfPages } from "./pdf-text";
import type { GuidebookDraft } from "./types";

export interface Progress {
  label: string;
  pct: number | null; // null = indeterminate
}

/**
 * Reads a guidebook (PDF or pasted text) into a GuidebookDraft through /api/guidebook.
 * The PDF's text is extracted here page by page, so only a few KB are sent regardless of the file size;
 * scanned PDFs (no text layer) go up whole when small, or as rendered page images when large.
 */
export async function analyzeGuidebook({ file, text, onProgress }: { file?: File; text?: string; onProgress?: (p: Progress) => void }): Promise<{ draft?: GuidebookDraft; error?: string; note?: string }> {
  let note: string | undefined;
  try {
    const body = new FormData();
    if (file) {
      onProgress?.({ label: "Membaca halaman…", pct: 0 });
      const extracted = await extractPdfText(file, undefined, (p, total) => onProgress?.({ label: `Membaca halaman ${p} dari ${total}`, pct: Math.round((100 * p) / total) })).catch(() => "");
      if (extracted.length >= 200) body.append("text", extracted);
      else if (file.size <= 4 * 1024 * 1024) body.append("file", file);
      else {
        const { pages, total } = await renderPdfPages(file, undefined, undefined, (p, n) => onProgress?.({ label: `Memindai halaman ${p} dari ${n}`, pct: Math.round((100 * p) / n) })).catch(() => ({ pages: [] as Blob[], total: 0 }));
        if (pages.length === 0) return { error: "PDF scan ini tidak bisa dibaca. Kompres PDF-nya atau tempel teks guidebook secara manual." };
        pages.forEach((blob, i) => body.append("page", blob, `p${i + 1}.jpg`));
        if (pages.length < total) note = `PDF berupa scan: hanya ${pages.length} dari ${total} halaman pertama yang dibaca.`;
      }
    } else if (text && text.trim().length >= 40) {
      body.append("text", text);
    } else {
      return { error: "Unggah PDF atau tempel minimal beberapa baris teks guidebook." };
    }

    onProgress?.({ label: "Menganalisis babak, rubrik, dan aturan dengan AI…", pct: null });
    const res = await fetch("/api/guidebook", { method: "POST", body });
    const json = (await res.json().catch(() => ({}))) as { draft?: GuidebookDraft; error?: string };
    if (res.status === 413) return { error: "Berkas terlalu besar untuk dikirim. Tempel teks guidebook secara manual." };
    if (!res.ok || !json.draft) return { error: json.error ?? "Gagal membaca guidebook." };
    return { draft: json.draft, note };
  } catch {
    return { error: "Tidak bisa menghubungi server. Periksa koneksi Anda." };
  }
}
