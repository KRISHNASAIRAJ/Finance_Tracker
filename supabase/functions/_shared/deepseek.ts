/**
 * Shared DeepSeek client for Edge Functions.
 * OpenAI-compatible chat completions (https://api.deepseek.com/v1).
 *
 * Secrets:
 *  - DEEPSEEK_API_KEY     (required to use this client)
 *  - DEEPSEEK_MODEL       (optional, default: deepseek-v4-flash)
 *  - DEEPSEEK_BASE_URL    (optional, default: https://api.deepseek.com/v1)
 */

export interface DeepSeekConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";

export function createDeepSeekClient(config?: DeepSeekConfig) {
  const apiKey = config?.apiKey ?? Deno.env.get("DEEPSEEK_API_KEY") ?? "";
  const model = config?.model ?? Deno.env.get("DEEPSEEK_MODEL") ?? DEFAULT_MODEL;
  const baseUrl = config?.baseUrl ?? Deno.env.get("DEEPSEEK_BASE_URL") ?? DEFAULT_BASE_URL;

  return {
    async complete(params: {
      systemPrompt: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      maxTokens?: number;
      temperature?: number;
      jsonMode?: boolean;
    }): Promise<string> {
      const messages = [
        { role: "system" as const, content: params.systemPrompt },
        ...params.messages,
      ];

      const reqBody: Record<string, unknown> = {
        model,
        messages,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.7,
      };

      if (params.jsonMode) {
        reqBody.response_format = { type: "json_object" };
      }

      const postBody = JSON.stringify(reqBody);
      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      let resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: postBody,
      });

      // Retry on rate limit (429) with backoff, up to 3 attempts
      let attempts = 0;
      while (resp.status === 429 && attempts < 3) {
        attempts += 1;
        const retryAfter = Number(resp.headers.get("retry-after")) || 5;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: postBody,
        });
      }

      const body = await resp.json();

      if (!resp.ok) {
        throw new Error(`DeepSeek API error: ${resp.status} ${JSON.stringify(body)}`);
      }

      return body.choices?.[0]?.message?.content ?? "";
    },

    DISCLAIMER_PORTFOLIO:
      "For informational purposes only. This is not investment advice. Consult a SEBI-registered advisor.",
  };
}

export type DeepSeekClient = ReturnType<typeof createDeepSeekClient>;
