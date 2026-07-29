/**
 * Shared Hugging Face Inference client.
 * Uses free serverless inference API via /v1/chat/completions endpoint.
 *
 * Model: Qwen/Qwen2.5-VL-7B-Instruct (Apache 2.0, free, vision-capable)
 * Note: First request triggers cold start (~10-60s model loading).
 */

export interface HFVisionParams {
  systemPrompt: string;
  imageBase64: string;
  imageMime: string;
  userText?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface HFVisionResult {
  content: string;
}

const VISION_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct";
const HF_CHAT_URL = "https://api-inference.huggingface.co/v1/chat/completions";

export function createHFClient(config?: { apiKey?: string }) {
  const apiKey = config?.apiKey ?? Deno.env.get("HF_API_KEY") ?? "";

  return {
    async completeVision(params: HFVisionParams): Promise<HFVisionResult> {
      if (!apiKey) {
        throw new Error("HF_API_KEY is not configured.");
      }

      const dataUri = `data:${params.imageMime};base64,${params.imageBase64}`;

      const reqBody = {
        model: VISION_MODEL,
        messages: [
          {
            role: "system" as const,
            content: params.systemPrompt,
          },
          {
            role: "user" as const,
            content: [
              { type: "text", text: params.userText || "Analyze this meal photo. Identify all food items and estimate nutrition. Output ONLY the JSON response." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: params.maxTokens ?? 1500,
        temperature: params.temperature ?? 0.3,
      };

      const imgKB = Math.round(params.imageBase64.length / 1024);
      console.log(`[HF] Calling ${VISION_MODEL} — image: ${imgKB}KB`);

      const resp = await fetch(HF_CHAT_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
      });

      const respText = await resp.text();

      if (!resp.ok) {
        const preview = respText.substring(0, 500);
        console.error(`[HF] HTTP ${resp.status}: ${preview}`);

        if (resp.status === 503 && respText.includes("loading")) {
          throw new Error("HF model is loading (cold start). Please wait 30-60s and try again.");
        }
        if (resp.status === 403) {
          throw new Error("HF access denied. Go to https://huggingface.co/settings/tokens and ensure your token has 'Make calls to the serverless Inference API' permission.");
        }
        if (resp.status === 429) {
          throw new Error("HF rate limit reached. Wait a moment and try again.");
        }
        throw new Error(`HF API error ${resp.status}: ${preview}`);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(respText);
      } catch {
        throw new Error(`HF returned non-JSON: ${respText.substring(0, 200)}`);
      }

      const content = parsed.choices?.[0]?.message?.content ?? "";
      if (!content) {
        console.error("[HF] Empty response body:", respText.substring(0, 400));
        throw new Error("HF returned empty response. The model may still be loading (cold start).");
      }

      console.log(`[HF] Success — ${content.length} chars`);
      return { content };
    },
  };
}

export type HFClient = ReturnType<typeof createHFClient>;
export { VISION_MODEL };
