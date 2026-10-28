/**
 * Reads the text layer of a PDF in the browser, so big guidebooks never have to be uploaded
 * (serverless hosts cap request bodies at a few MB). Scanned PDFs have no text layer and return "".
 */
export async function extractPdfText(file: File, maxChars = 200_000, onPage?: (page: number, total: number) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let out = "";
  try {
    for (let p = 1; p <= doc.numPages && out.length < maxChars; p++) {
      onPage?.(p, doc.numPages);
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Keep line breaks where the PDF breaks lines, so bullets and dates stay on their own lines.
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          out += line + "\n";
          line = "";
        } else {
          line += " ";
        }
      }
      out += line + "\n";
    }
  } finally {
    await doc.destroy();
  }
  return out.replace(/[ \t]+\n/g, "\n").trim().slice(0, maxChars);
}

/**
 * For scanned PDFs (no text layer): renders the first pages to downscaled JPEGs that together fit `maxBytes`,
 * so the model can read them as images. Returns the pages and how many the document has in total.
 */
export async function renderPdfPages(file: File, maxBytes = 3.5 * 1024 * 1024, maxPages = 16, onPage?: (page: number, total: number) => void): Promise<{ pages: Blob[]; total: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: Blob[] = [];
  let used = 0;
  try {
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      onPage?.(p, Math.min(doc.numPages, maxPages));
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1200 / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.6));
      if (!blob || used + blob.size > maxBytes) break;
      pages.push(blob);
      used += blob.size;
    }
    return { pages, total: doc.numPages };
  } finally {
    await doc.destroy();
  }
}
