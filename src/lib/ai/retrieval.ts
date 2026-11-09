import { db } from "@/lib/db";

// Lightweight BM25 retrieval over a company's document chunks. We deliberately
// skip a vector-embeddings pipeline for this narrow MVP - it would need a
// second API key/service with no extra value at this scale (a handful of
// documents per company). BM25 is a real, well-understood ranking function,
// not a placeholder; swapping in pgvector + embeddings later is a drop-in
// change to this one module. See README "Where I'd take it next".

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "is", "are", "was", "were",
  "it", "its", "this", "that", "with", "as", "by", "at", "be", "has", "have", "had", "from",
  "which", "we", "our", "company", "companys",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%₹.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

type ScoredChunk = {
  chunkId: number;
  documentId: number;
  documentType: string;
  period: string | null;
  pageNumber: number | null;
  text: string;
  score: number;
};

const K1 = 1.5;
const B = 0.75;

/** BM25-ranks a company's document chunks against a free-text query. */
export async function retrieveRelevantChunks(
  companyId: number,
  query: string,
  topK = 10
): Promise<ScoredChunk[]> {
  const chunks = await db.documentChunk.findMany({
    where: { companyId },
    include: { document: { select: { documentType: true, period: true } } },
  });
  if (chunks.length === 0) return [];

  const docTokens = chunks.map((c) => tokenize(c.text));
  const docLengths = docTokens.map((t) => t.length);
  const avgLen = docLengths.reduce((s, l) => s + l, 0) / docLengths.length;

  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const N = chunks.length;
  const idf = (term: string) => {
    const n = df.get(term) ?? 0;
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  };

  const queryTerms = Array.from(new Set(tokenize(query)));

  const scored: ScoredChunk[] = chunks.map((c, i) => {
    const tokens = docTokens[i];
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const numerator = f * (K1 + 1);
      const denominator = f + K1 * (1 - B + B * (docLengths[i] / (avgLen || 1)));
      score += idf(term) * (numerator / denominator);
    }

    return {
      chunkId: c.id,
      documentId: c.documentId,
      documentType: c.document.documentType,
      period: c.document.period,
      pageNumber: c.pageNumber,
      text: c.text,
      score,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
