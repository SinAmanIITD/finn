// Announcement taxonomy, per the challenge's companion reference document.
export const ANNOUNCEMENT_CATEGORIES = [
  "results",
  "M&A",
  "fund_raise",
  "management_change",
  "litigation",
  "insider_trading",
  "earnings_call",
  "investor_meetings",
  "credit_rating",
  "dividend",
  "bonus_split",
  "capex",
  "press_release",
  "postal_ballot",
  "agm_egm",
  "pledging",
  "unclassified",
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
export type Importance = "high" | "medium" | "low";

// Starting heuristics, per the brief: "these are starting heuristics, not universal financial truths."
const DEFAULT_IMPORTANCE: Record<AnnouncementCategory, Importance> = {
  results: "high",
  "M&A": "high",
  fund_raise: "medium",
  management_change: "high",
  litigation: "high",
  insider_trading: "medium",
  earnings_call: "medium",
  investor_meetings: "low",
  credit_rating: "medium",
  dividend: "medium",
  bonus_split: "medium",
  capex: "medium",
  press_release: "low",
  postal_ballot: "low",
  agm_egm: "low",
  pledging: "medium",
  unclassified: "low",
};

export function categoryImportance(category: AnnouncementCategory): Importance {
  return DEFAULT_IMPORTANCE[category] ?? "low";
}
