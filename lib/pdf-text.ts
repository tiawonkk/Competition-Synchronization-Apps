/**
 * Reads the text layer of a PDF in the browser, so big guidebooks never have to be uploaded
 * (serverless hosts cap request bodies at a few MB). Scanned PDFs have no text layer and return "".
 */
export async function extractPdfText(file: File, maxChars = 60_000): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let out = "";
  try {
    for (let p = 1; p <= doc.numPages && out.length < maxChars; p++) {
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
