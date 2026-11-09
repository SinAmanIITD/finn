import { PDFParse } from "pdf-parse";
import { db } from "@/lib/db";

type PageText = { num: number; text: string };

async function downloadPdf(url: string): Promise<Buffer> {
  // No custom headers: some exchange/IR document hosts (BSE in particular)
  // block requests that self-identify as a bot via User-Agent, but allow a
  // plain, ordinary HTTP client - so we send exactly that, nothing more.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download PDF (${res.status}): ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractPdfPages(buffer: Buffer): Promise<PageText[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => ({ num: p.num, text: p.text }));
  } finally {
    await parser.destroy();
  }
}

export type TextChunk = { pageNumber: number; chunkIndex: number; text: string };

/** Splits page text into ~CHUNK_SIZE-character chunks with overlap, keeping page attribution. */
export function chunkPages(pages: PageText[], chunkSize = 1400, overlap = 200): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({ pageNumber: page.num, chunkIndex: chunkIndex++, text: text.slice(start, end) });
      if (end === text.length) break;
      start = end - overlap;
    }
  }
  return chunks;
}

/** Downloads, extracts, chunks, and stores a document's text. Idempotent: re-ingesting replaces old chunks. */
export async function ingestDocument(documentId: number): Promise<{ chunks: number }> {
  const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });

  try {
    const buffer = await downloadPdf(doc.sourceUrl);
    const pages = await extractPdfPages(buffer);
    const chunks = chunkPages(pages);

    await db.$transaction([
      db.documentChunk.deleteMany({ where: { documentId } }),
      ...chunks.map((c) =>
        db.documentChunk.create({
          data: {
            documentId,
            companyId: doc.companyId,
            pageNumber: c.pageNumber,
            chunkIndex: c.chunkIndex,
            text: c.text,
          },
        })
      ),
      db.document.update({ where: { id: documentId }, data: { status: "parsed" } }),
    ]);

    return { chunks: chunks.length };
  } catch (e) {
    await db.document.update({ where: { id: documentId }, data: { status: "failed" } });
    throw e;
  }
}

export async function ingestAllPendingDocuments() {
  const pending = await db.document.findMany({ where: { status: "pending" } });
  const results: { id: number; ok: boolean; chunks?: number; error?: string }[] = [];
  for (const d of pending) {
    try {
      const { chunks } = await ingestDocument(d.id);
      results.push({ id: d.id, ok: true, chunks });
    } catch (e) {
      results.push({ id: d.id, ok: false, error: (e as Error).message });
    }
  }
  return results;
}
