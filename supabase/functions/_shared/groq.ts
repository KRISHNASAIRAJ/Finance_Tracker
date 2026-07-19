/**
 * Shared Groq client for Edge Functions.
 * Used by ai-tnc-query, ai-portfolio-recommend, ai-sms-parse.
 *
 * Groq offers generous free tier (Llama models): ~7,000 req/day, 30 req/min.
 * Significantly cheaper than Anthropic Claude.
 */

export interface GroqConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const FAST_MODEL = "llama-3.1-8b-instant";

export function createGroqClient(config?: GroqConfig) {
  const apiKey = config?.apiKey ?? Deno.env.get("GROQ_API_KEY") ?? "";
  const model = config?.model ?? DEFAULT_MODEL;

  return {
    async complete(params: {
      systemPrompt: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      maxTokens?: number;
      temperature?: number;
    }): Promise<string> {
      const messages = [
        { role: "system" as const, content: params.systemPrompt },
        ...params.messages,
      ];

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: params.maxTokens ?? 1024,
          temperature: params.temperature ?? 0.7,
        }),
      });

      const body = await resp.json();

      if (!resp.ok) {
        throw new Error(`Groq API error: ${resp.status} ${JSON.stringify(body)}`);
      }

      return body.choices?.[0]?.message?.content ?? "";
    },

    DISCLAIMER_TNC:
      "Based on the document you uploaded — verify with your bank for current terms.",
    DISCLAIMER_PORTFOLIO:
      "For informational purposes only. This is not investment advice.",
  };
}

export type GroqClient = ReturnType<typeof createGroqClient>;
export { DEFAULT_MODEL, FAST_MODEL };
