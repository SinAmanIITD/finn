import { ANNOUNCEMENT_CATEGORIES, categoryImportance, type AnnouncementCategory, type Importance } from "@/lib/data/categories";
import { completeJSON, MODELS } from "@/lib/ai/provider";
import { CLASSIFIER_SYSTEM, classifierPrompt } from "@/lib/ai/prompts";

export type ClassificationResult = {
  category: AnnouncementCategory;
  importance: Importance;
  summary: string;
  reason: string;
  method: "rule" | "ai" | "fallback";
};

// Deterministic rules for the obvious, high-volume cases - NSE's own subject
// line is usually unambiguous. Only what doesn't match goes to the LLM.
// Checked in order; first match wins.
const RULES: Array<{ pattern: RegExp; category: AnnouncementCategory }> = [
  { pattern: /financial results|board meeting outcome.*result|unaudited|audited financial/i, category: "results" },
  { pattern: /acquisition|merger|demerger|scheme of arrangement|joint venture|stake (sale|purchase)/i, category: "M&A" },
  { pattern: /rights issue|qip|preferential allotment|buyback|commercial paper|fund.?rais/i, category: "fund_raise" },
  { pattern: /change in (director|key managerial|kmp)|resign|appoint.*\b(ceo|cfo|md|director)\b|cessation of/i, category: "management_change" },
  // "restructuring" alone is too broad (ordinary business restructuring isn't litigation) -
  // only treated as litigation when it's debt/insolvency restructuring specifically.
  { pattern: /litigation|lawsuit|regulatory order|penalty|fine impos|insolvency|nclt|debt restructuring|insolvency.{0,20}restructuring/i, category: "litigation" },
  { pattern: /insider trading|sast|\bpit\b regulation/i, category: "insider_trading" },
  { pattern: /con\.? call|earnings call|concall|conference call/i, category: "earnings_call" },
  { pattern: /investor meet|analyst meet|institutional investor/i, category: "investor_meetings" },
  { pattern: /credit rating/i, category: "credit_rating" },
  { pattern: /dividend/i, category: "dividend" },
  { pattern: /bonus issue|stock split|sub.?division of shares/i, category: "bonus_split" },
  { pattern: /capital expenditure|capacity expansion|new plant|new facility/i, category: "capex" },
  { pattern: /press release|order win|new product|partnership/i, category: "press_release" },
  { pattern: /postal ballot/i, category: "postal_ballot" },
  { pattern: /annual general meeting|\bagm\b|extraordinary general meeting|\begm\b/i, category: "agm_egm" },
  { pattern: /pledg/i, category: "pledging" },
  { pattern: /esop|compliance certificate|esg report|auditor appointment|general update/i, category: "unclassified" },
];

function ruleClassify(subject: string, description: string): AnnouncementCategory | null {
  const haystack = `${subject} ${description}`;
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.category;
  }
  return null;
}

function oneLineSummary(subject: string, description: string): string {
  const text = description || subject;
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/**
 * Classifies one announcement. Deterministic rules handle the obvious bulk of
 * cases for free; the LLM is only called for genuinely ambiguous ones — the
 * "efficient model routing" the brief rewards.
 */
export async function classifyAnnouncement(
  companyName: string,
  subject: string,
  description: string
): Promise<ClassificationResult> {
  const ruled = ruleClassify(subject, description);
  if (ruled) {
    return {
      category: ruled,
      importance: categoryImportance(ruled),
      summary: oneLineSummary(subject, description),
      reason: `Classified via rule match on "${subject}".`,
      method: "rule",
    };
  }

  const { data } = await completeJSON<{
    category: string;
    importance: Importance;
    summary: string;
    reason: string;
  }>({
    system: CLASSIFIER_SYSTEM,
    prompt: classifierPrompt(companyName, subject, description),
    model: MODELS.cheap,
    maxTokens: 450, // headroom for the cheap tier's hidden reasoning tokens, even at low effort
  });

  if (data && (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(data.category)) {
    return {
      category: data.category as AnnouncementCategory,
      importance: data.importance ?? categoryImportance(data.category as AnnouncementCategory),
      summary: data.summary ?? oneLineSummary(subject, description),
      reason: data.reason ?? "",
      method: "ai",
    };
  }

  // No API key, or the model returned something we can't trust: never invent a category.
  return {
    category: "unclassified",
    importance: "low",
    summary: oneLineSummary(subject, description),
    reason: "Could not confidently classify (no AI configured or invalid response) - left unclassified rather than guessed.",
    method: "fallback",
  };
}
