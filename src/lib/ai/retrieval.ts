import { db } from "@/lib/db";
import { embedOne, cosineSimilarity, isEmbeddingConfigured } from "@/lib/ai/embeddings";

// Retrieval over a company's document chunks, with two engines:
//   1. OpenAI embeddings + cosine similarity, when OPENAI_API_KEY is set and
//      the chunks were embedded at ingestion time.
//   2. A hand-rolled BM25 ranker as the fallback - real, well-understood, and
//      what keeps the app fully functional with zero API keys configured.
// This means retrieval quality upgrades automatically the moment an OpenAI
// key is added, with no behaviour change required elsewhere in the app.

export type ScoredChunk = {
  chunkId: number;
  documentId: number;
  documentType: string;
  period: string | null;
  pageNumber: number | null;
  text: string;
  score: number;
};

export async function retrieveRelevantChunks(companyId: number, query: string, topK = 10): Promise<ScoredChunk[]> {
  if (isEmbeddingConfigured()) {
    const embedded = await retrieveByEmbedding(companyId, query, topK);
    if (embedded.length > 0) return embedded;
    // Falls through to BM25 if nothing's been embedded yet (e.g. ingested before a key was set).
  }
  return retrieveBM25(companyId, query, topK);
}

async function retrieveByEmbedding(companyId: number, query: string, topK: number): Promise<ScoredChunk[]> {
  const chunks = await db.documentChunk.findMany({
    where: { companyId, embedding: { not: null } },
    include: { document: { select: { documentType: true, period: true } } },
  });
  if (chunks.length === 0) return [];

  const queryVector = await embedOne(query);

  const scored: ScoredChunk[] = chunks.map((c) => ({
    chunkId: c.id,
    documentId: c.documentId,
    documentType: c.document.documentType,
    period: c.document.period,
    pageNumber: c.pageNumber,
    text: c.text,
    score: cosineSimilarity(queryVector, JSON.parse(c.embedding as string)),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

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

const K1 = 1.5;
const B = 0.75;

/** BM25-ranks a company's document chunks against a free-text query. */
async function retrieveBM25(companyId: number, query: string, topK: number): Promise<ScoredChunk[]> {
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
