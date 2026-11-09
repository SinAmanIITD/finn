import Anthropic from "@anthropic-ai/sdk";

// Smart model routing: a cheap/fast model for high-volume, low-ambiguity work
// (classification, short summaries), a stronger reasoning model only where it's
// actually needed (research synthesis, guidance-vs-actuals, bull/bear). This is
// the efficiency instinct the brief calls out explicitly.
export const MODELS = {
  cheap: "claude-haiku-5-5",
  strong: "claude-sonnet-5-5",
} as const;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type CompleteResult = { text: string; demo: boolean; model: string };

/**
 * Calls Claude with a system+user prompt. If no API key is configured, returns
 * a clearly-labelled demo-mode result instead of silently failing or faking a
 * confident answer — the brief is explicit that mock data must be labelled.
 */
export async function complete(params: {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<CompleteResult> {
  const model = params.model ?? MODELS.cheap;
  if (!isAiConfigured()) {
    return { text: "", demo: true, model: "demo" };
  }
  const res = await getClient().messages.create({
    model,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, demo: false, model };
}

/** Same as complete(), but parses the response as JSON with one repair retry. */
export async function completeJSON<T>(params: {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<{ data: T | null; demo: boolean; model: string; raw: string }> {
  const result = await complete({
    ...params,
    system: `${params.system}\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.`,
  });
  if (result.demo) return { data: null, demo: true, model: result.model, raw: "" };

  const parsed = tryParseJson<T>(result.text);
  if (parsed) return { data: parsed, demo: false, model: result.model, raw: result.text };

  // One repair attempt: ask the model to fix its own output.
  const repair = await complete({
    system: "You output ONLY valid JSON, nothing else.",
    prompt: `This was supposed to be valid JSON but failed to parse:\n\n${result.text}\n\nReturn the corrected, valid JSON only.`,
    model: params.model ?? MODELS.cheap,
    maxTokens: params.maxTokens ?? 1024,
  });
  const repaired = tryParseJson<T>(repair.text);
  return { data: repaired, demo: false, model: result.model, raw: repair.text };
}

function tryParseJson<T>(text: string): T | null {
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}
