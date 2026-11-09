// Pure data (no server-only imports) so client components can safely import
// this for labels/tabs without pulling in Prisma/Anthropic/pdf-parse.
export const RESEARCH_SECTIONS = {
  business_snapshot: {
    label: "Business snapshot",
    instructions: "What the company does, its segments, revenue mix, and business model.",
    query: "business overview segments revenue mix products services operations",
  },
  financial_snapshot: {
    label: "Financial snapshot",
    instructions: "Current headline numbers (revenue, margins, PAT, key ratios) at a glance, most recent period.",
    query: "revenue EBITDA margin profit PAT total income financial results highlights",
  },
  cash_quality: {
    label: "Cash quality",
    instructions:
      "Cash-flow trend and cash conversion: do reported profits actually turn into cash? Compare operating cash flow to PAT across recent periods, and flag capex intensity if relevant.",
    query: "cash flow from operations free cash flow capital expenditure cash conversion",
  },
  narrative_vs_numbers: {
    label: "Narrative vs. numbers",
    instructions:
      "Compare the last four quarters of management's own stated guidance/growth commentary (from concall transcripts) against what was actually delivered (from the financial results). State explicitly what was promised, what was delivered, and the gap. This is the section investors value most - be precise and evidence-driven, not vague.",
    query: "guidance outlook expect target growth margin next quarter management commentary",
  },
} as const;

export type ResearchSectionType = keyof typeof RESEARCH_SECTIONS;
