import { db } from "@/lib/db";
import { retrieveRelevantChunks } from "@/lib/ai/retrieval";
import { complete, completeJSON, isAiConfigured, MODELS } from "@/lib/ai/provider";
import { RESEARCH_SYSTEM, researchPrompt, GUIDANCE_VS_ACTUALS_SYSTEM } from "@/lib/ai/prompts";
import { RESEARCH_SECTIONS, type ResearchSectionType } from "@/lib/data/researchSections";

export { RESEARCH_SECTIONS, type ResearchSectionType };

export type ResearchSectionResult = {
  sectionType: ResearchSectionType;
  content: string;
  sourceRefs: { document: string; period: string | null; page: number | null }[];
  demo: boolean;
  model: string;
};

export async function generateResearchSection(
  companyId: number,
  sectionType: ResearchSectionType
): Promise<ResearchSectionResult> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const section = RESEARCH_SECTIONS[sectionType];

  const chunks = await retrieveRelevantChunks(companyId, `${section.query} ${section.label}`, 10);

  if (chunks.length === 0) {
    return {
      sectionType,
      content:
        "No primary-source documents (annual reports / concall transcripts) have been ingested for this company yet, " +
        "so I won't generate an analysis grounded in nothing. Add a document via /api/research/ingest and try again.",
      sourceRefs: [],
      demo: true,
      model: "none",
    };
  }

  const evidence = chunks.map((c) => ({
    document: c.documentType === "annual_report" ? "Annual Report" : "Concall Transcript",
    period: c.period,
    page: c.pageNumber,
    text: c.text,
  }));

  if (!isAiConfigured()) {
    return {
      sectionType,
      content:
        `**Demo mode** (no ANTHROPIC_API_KEY set): ${chunks.length} relevant primary-source excerpts were ` +
        `retrieved for "${section.label}" but no LLM is configured to synthesise them into analysis. ` +
        `Raw evidence is listed in sourceRefs below. Add a key to .env to see the real analysis.`,
      sourceRefs: evidence.map((e) => ({ document: e.document, period: e.period, page: e.page })),
      demo: true,
      model: "demo",
    };
  }

  const result = await complete({
    system: RESEARCH_SYSTEM,
    prompt: researchPrompt({
      companyName: company.name,
      ticker: company.ticker,
      section: section.label,
      sectionInstructions: section.instructions,
      evidence,
    }),
    model: MODELS.strong, // research synthesis is where reasoning quality matters
    maxTokens: 1200,
  });

  await db.researchReport.create({
    data: {
      companyId,
      sectionType,
      content: result.text,
      sourceRefs: JSON.stringify(evidence.map((e) => ({ document: e.document, period: e.period, page: e.page }))),
      model: result.model,
    },
  });

  return {
    sectionType,
    content: result.text,
    sourceRefs: evidence.map((e) => ({ document: e.document, period: e.period, page: e.page })),
    demo: false,
    model: result.model,
  };
}

export type ChatAnswer = {
  answer: string;
  sources: { document: string; period: string | null; page: number | null }[];
  demo: boolean;
};

/** Free-form "Ask FINN" Q&A for one company, grounded in the same primary-source evidence. */
export async function answerQuestion(companyId: number, question: string): Promise<ChatAnswer> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const chunks = await retrieveRelevantChunks(companyId, question, 10);

  if (chunks.length === 0) {
    return {
      answer:
        `No primary-source documents are ingested for ${company.name} yet, so I can't ground an answer. ` +
        `Add an annual report or concall transcript via /api/research/${company.ticker}/documents first.`,
      sources: [],
      demo: true,
    };
  }

  const evidence = chunks.map((c) => ({
    document: c.documentType === "annual_report" ? "Annual Report" : "Concall Transcript",
    period: c.period,
    page: c.pageNumber,
    text: c.text,
  }));

  if (!isAiConfigured()) {
    return {
      answer:
        `**Demo mode** (no ANTHROPIC_API_KEY set): found ${chunks.length} relevant excerpts for "${question}" ` +
        `but no LLM is configured to answer from them. Add a key to .env to get a real answer.`,
      sources: evidence.map((e) => ({ document: e.document, period: e.period, page: e.page })),
      demo: true,
    };
  }

  const result = await complete({
    system: RESEARCH_SYSTEM,
    prompt: researchPrompt({
      companyName: company.name,
      ticker: company.ticker,
      section: "Answer to investor question",
      sectionInstructions: question,
      evidence,
    }),
    model: MODELS.strong,
    maxTokens: 900,
  });

  return {
    answer: result.text,
    sources: evidence.map((e) => ({ document: e.document, period: e.period, page: e.page })),
    demo: false,
  };
}

export type GuidanceVsActualsItem = {
  metric: string;
  guidance: string;
  guidancePeriod: string;
  guidanceSource: string;
  target: string;
  actual: string;
  differencePct: string;
  managementComment: string;
  interpretation: string;
};

export async function generateGuidanceVsActuals(companyId: number): Promise<{
  items: GuidanceVsActualsItem[];
  demo: boolean;
}> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const guidanceChunks = await retrieveRelevantChunks(companyId, "guidance outlook expect target next year margin growth", 8);
  const resultChunks = await retrieveRelevantChunks(companyId, "revenue EBITDA PAT margin actual results quarter", 8);
  const all = [...guidanceChunks, ...new Map(resultChunks.map((c) => [c.chunkId, c])).values()];

  if (all.length === 0 || !isAiConfigured()) {
    return { items: [], demo: true };
  }

  const evidenceBlock = all
    .map((c, i) => `[${i + 1}] ${c.documentType}${c.period ? ` (${c.period})` : ""}, p.${c.pageNumber}\n${c.text}`)
    .join("\n\n---\n\n");

  const { data } = await completeJSON<GuidanceVsActualsItem[]>({
    system: GUIDANCE_VS_ACTUALS_SYSTEM,
    prompt: `Company: ${company.name} (${company.ticker})\n\nEVIDENCE:\n${evidenceBlock}`,
    model: MODELS.strong,
    maxTokens: 1600,
  });

  return { items: data ?? [], demo: false };
}
