/**
 * Shared Groq client for Edge Functions.
 * Used by ai-tnc-query, ai-portfolio-recommend, ai-meal-log.
 *
 * Groq offers generous free tier (~7,000 req/day, 30 req/min).
 * Significantly cheaper than Anthropic Claude.
 *
 * Text models: openai/gpt-oss-120b (default), openai/gpt-oss-20b (fast).
 * Vision model: qwen/qwen3.6-27b (supports images + text, JSON mode).
 */

export interface GroqConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const FAST_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

export interface ContentPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  type: "image_url";
  image_url: { url: string };
}

export interface VisionMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<ContentPart | ImagePart>;
}

export interface VisionCompleteParams {
  systemPrompt: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string | Array<ContentPart | ImagePart>;
  }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface VisionCompleteResult {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export function createGroqClient(config?: GroqConfig) {
  const apiKey = config?.apiKey ?? Deno.env.get("GROQ_API_KEY") ?? "";
  const model = config?.model ?? DEFAULT_MODEL;

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

      const maxTokens = params.maxTokens ?? 1024;

      const reqBody: Record<string, unknown> = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: params.temperature ?? 0.7,
      };

      if (params.jsonMode) {
        reqBody.response_format = { type: "json_object" };
      }

      const postBody = JSON.stringify(reqBody);

      let resp = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: postBody,
        },
      );

      // Retry on rate limit (429) with backoff, up to 3 attempts
      let attempts = 0;
      while (resp.status === 429 && attempts < 3) {
        attempts += 1;
        const retryAfter = Number(resp.headers.get("retry-after")) || 5;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: postBody,
        });
      }

      const body = await resp.json();

      if (!resp.ok) {
        throw new Error(
          `Groq API error: ${resp.status} ${JSON.stringify(body)}`,
        );
      }

      return body.choices?.[0]?.message?.content ?? "";
    },

    async completeVision(
      params: VisionCompleteParams,
    ): Promise<VisionCompleteResult> {
      const messages: VisionMessage[] = [
        { role: "system", content: params.systemPrompt },
      ];

      for (const m of params.messages) {
        messages.push({ role: m.role, content: m.content });
      }

      const reqBody: Record<string, unknown> = {
        model: VISION_MODEL,
        messages,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.7,
      };

      if (params.jsonMode) {
        reqBody.response_format = { type: "json_object" };
      }

      const resp = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reqBody),
        },
      );

      const body = await resp.json();

      if (!resp.ok) {
        throw new Error(
          `Groq API vision error: ${resp.status} ${JSON.stringify(body)}`,
        );
      }

      return {
        content: body.choices?.[0]?.message?.content ?? "",
        usage: body.usage,
      };
    },

    DISCLAIMER_TNC:
      "Based on the document you uploaded — verify with your bank for current terms.",
    DISCLAIMER_PORTFOLIO:
      "For informational purposes only. This is not investment advice.",
  };
}

export type GroqClient = ReturnType<typeof createGroqClient>;
export { DEFAULT_MODEL, FAST_MODEL, VISION_MODEL };
