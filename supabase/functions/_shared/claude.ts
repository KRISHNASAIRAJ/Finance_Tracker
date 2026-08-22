/**
 * Shared Anthropic (Claude) client for Edge Functions.
 * Used by ai-tnc-query, ai-portfolio-recommend.
 *
 * Phase 6 — not deployed yet.
 */

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

export function createClaudeClient(config?: ClaudeConfig) {
  const apiKey = config?.apiKey ?? Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const model = config?.model ?? DEFAULT_MODEL;

  return {
    async complete(params: {
      systemPrompt: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      maxTokens?: number;
    }): Promise<string> {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          system: params.systemPrompt,
          messages: params.messages,
          max_tokens: params.maxTokens ?? 1024,
        }),
      });

      const body = await resp.json();

      if (!resp.ok) {
        throw new Error(
          `Claude API error: ${resp.status} ${JSON.stringify(body)}`,
        );
      }

      return body.content?.[0]?.text ?? "";
    },

    DISCLAIMER_TNC:
      "Based on the document you uploaded — verify with your bank for current terms.",
    DISCLAIMER_PORTFOLIO:
      "For informational purposes only. This is not investment advice.",
  };
}

export type ClaudeClient = ReturnType<typeof createClaudeClient>;
