import OpenAI from "openai";

// Smart multi-provider model routing: Groq for high-volume, low-ambiguity work
// (classification, short summaries) where its free/near-free fast inference is
// plenty, and OpenAI for the reasoning-heavy work (research synthesis,
// guidance-vs-actuals) where answer quality matters most. Both speak the
// OpenAI-compatible chat-completions API, so one SDK covers both - only the
// baseURL and API key differ. This is the "efficient model routing" the brief
// calls out explicitly, just spread across providers instead of within one.
export type ModelTier = "cheap" | "strong";
export const MODELS: Record<ModelTier, ModelTier> = { cheap: "cheap", strong: "strong" };

type TierConfig = {
  provider: "groq" | "openai";
  model: string;
  apiKeyEnv: "GROQ_API_KEY" | "OPENAI_API_KEY";
  baseURL?: string;
  // Extra request params merged in for this tier only (e.g. Groq's gpt-oss
  // models are reasoning models that burn the token budget on hidden
  // chain-of-thought unless reined in).
  extraParams?: Record<string, unknown>;
};

// Model IDs are env-overridable: provider lineups move fast, and the right
// current model name may differ from these defaults by the time this runs.
const TIERS: Record<ModelTier, TierConfig> = {
  cheap: {
    provider: "groq",
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    apiKeyEnv: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    extraParams: { reasoning_effort: "low" },
  },
  strong: {
    provider: "openai",
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    apiKeyEnv: "OPENAI_API_KEY",
  },
};

export function isAiConfigured(tier: ModelTier = "strong"): boolean {
  return Boolean(process.env[TIERS[tier].apiKeyEnv]);
}

/** True if either provider is configured - matches complete()'s cross-tier fallback behaviour. */
export function isAnyAiConfigured(): boolean {
  return isAiConfigured("cheap") || isAiConfigured("strong");
}

const clients = new Map<ModelTier, OpenAI>();
function getClient(tier: ModelTier): OpenAI {
  let client = clients.get(tier);
  if (!client) {
    const cfg = TIERS[tier];
    client = new OpenAI({ apiKey: process.env[cfg.apiKeyEnv], baseURL: cfg.baseURL });
    clients.set(tier, client);
  }
  return client;
}

export type CompleteResult = { text: string; demo: boolean; model: string; error?: string };

/**
 * Calls the configured model for a tier with a system+user prompt. If the
 * requested tier's key is missing, or its actual API call fails (quota,
 * deprecated model, outage, ...), falls back to the other configured
 * provider rather than crashing the request. Only once no provider can
 * answer at all does this return a clearly-labelled demo-mode result - the
 * brief is explicit that mock output must be labelled, and a provider error
 * shouldn't surface as a raw 500 to the investor using the app.
 */
export async function complete(params: {
  system: string;
  prompt: string;
  model?: ModelTier;
  maxTokens?: number;
}): Promise<CompleteResult> {
  const requested = params.model ?? "cheap";
  const other: ModelTier = requested === "cheap" ? "strong" : "cheap";
  const order = [requested, other].filter((t) => isAiConfigured(t));

  if (order.length === 0) {
    return { text: "", demo: true, model: "demo" };
  }

  let lastError: string | undefined;
  for (const tier of order) {
    const cfg = TIERS[tier];
    try {
      const res = await getClient(tier).chat.completions.create({
        model: cfg.model,
        max_tokens: params.maxTokens ?? 1024,
        ...(cfg.extraParams ?? {}),
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.prompt },
        ],
      });
      const text = res.choices[0]?.message?.content ?? "";
      if (text) return { text, demo: false, model: `${cfg.provider}:${cfg.model}` };
      lastError = `${cfg.provider}:${cfg.model} returned an empty response`;
    } catch (e) {
      lastError = `${cfg.provider}:${cfg.model} - ${(e as Error).message}`;
      console.error(`[ai] ${lastError}`);
    }
  }

  return { text: "", demo: true, model: "demo", error: lastError };
}

/** Same as complete(), but parses the response as JSON with one repair retry. */
export async function completeJSON<T>(params: {
  system: string;
  prompt: string;
  model?: ModelTier;
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
    model: params.model ?? "cheap",
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
