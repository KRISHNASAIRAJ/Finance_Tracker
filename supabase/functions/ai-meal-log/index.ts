/**
 * ai-meal-log Edge Function
 *
 * AI-powered meal detection and nutrition estimation.
 * Images: Hugging Face Qwen2.5-VL-7B-Instruct (free).
 * Text/Conversation: Groq Llama 3.3 70B (free).
 * Multi-turn conversation for clarifying uncertain items.
 *
 * Deploy: supabase functions deploy ai-meal-log
 * Secrets: GROQ_API_KEY, HF_API_KEY
 */

import { createGroqClient } from "../_shared/groq.ts";
import { createHFClient } from "../_shared/huggingface.ts";

const SYSTEM_PROMPT =
  `You are a nutritionist AI assistant for Meridian, a personal life tracker app.
You analyze meal photos or text descriptions and return structured food items with nutritional estimates.

The user is a 23-year-old male (54kg, 170.6cm, BMI 18.5 underweight) targeting weight gain to 65kg at ~0.4 kg/week. They eat Indian home-cooked meals.

Their daily nutrition targets: 2,650 kcal (range 2,600-2,800), 140g protein (~2.6 g/kg), 340g carbs, 85g fat, 2.5-3L water.
Fixed daily dose: 1 tbsp pumpkin seeds + 1 tbsp sesame seeds, 1 fruit (banana/avocado/pineapple), 1-2 tsp ghee, groundnut oil for cooking, 1 scoop Comix plant protein (~24g).
No non-veg on Wed & Thu. Only Greek yoghurt, no curd/buttermilk. Past Abdominal TB, took antibiotics, low immunity.
Cooks all meals 5:30-7:45 AM. Office 8 AM-6 PM, 40 min commute. Wakes 5:30 AM Mon-Thu, 7 AM Fri-Sun. Sleeps 10-11 PM.

RULES:
1. Return ONLY a valid JSON object. No markdown, no code fences, no extra text before or after.
2. For each food item, estimate: name, quantity (e.g. "200g", "1 cup", "1 piece"), calories, protein(g), carbs(g), fat(g).
3. Be honest about uncertainty. If you're unsure about a dish, ask ONE clarifying question at a time.
4. When analyzing food plates: identify each visible dish, estimate portion sizes based on typical Indian serving sizes.
5. When analyzing package labels: read the nutrition facts table. Calculate values for the suggested serving size.
6. For text descriptions: parse the described meal and estimate nutrition for each item.
7. Nutrition estimates should be realistic. Typical portions: rice 150-200g, dal 150-200ml, roti 30-40g each, sabzi 100-150g, chicken curry 150-200g.
8. Set isComplete: true only when confident about all items and have no more questions.
9. If the image is unclear, not food, or not a label, set isComplete: true, return empty items, and explain in message.

JSON RESPONSE FORMAT (exactly this structure):
{
  "items": [
    {
      "name": "Steamed Rice",
      "quantity": "200g",
      "calories": 260,
      "protein": 4,
      "carbs": 58,
      "fat": 0
    }
  ],
  "message": "I can see rice, yellow dal, and a green dish...",
  "hasQuestions": false,
  "isComplete": true
}`;

const DAILY_LIMIT = 50;
const RATE_LIMIT_KV: { date: string; count: number } = { date: "", count: 0 };

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkRateLimit(): boolean {
  const today = getToday();
  if (RATE_LIMIT_KV.date !== today) {
    RATE_LIMIT_KV.date = today;
    RATE_LIMIT_KV.count = 1;
    return true;
  }
  if (RATE_LIMIT_KV.count >= DAILY_LIMIT) return false;
  RATE_LIMIT_KV.count++;
  return true;
}

function emptyResponse(message: string) {
  return { items: [], message, hasQuestions: false, isComplete: true };
}

function extractJson(text: string): string {
  let cleaned = text.trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");

  // Try to find JSON object if there's extra text
  const braceStart = cleaned.indexOf("{");
  const braceEnd = cleaned.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    cleaned = cleaned.slice(braceStart, braceEnd + 1);
  }

  return cleaned;
}

function parseResponse(raw: string) {
  const jsonStr = extractJson(raw);

  try {
    const parsed = JSON.parse(jsonStr);
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item: any) => ({
        name: String(item.name || ""),
        quantity: String(item.quantity || ""),
        calories: Number(item.calories || 0),
        protein: Number(item.protein || 0),
        carbs: Number(item.carbs || 0),
        fat: Number(item.fat || 0),
      }))
      : [];

    return {
      items,
      message: String(parsed.message || raw.substring(0, 300)),
      hasQuestions: Boolean(parsed.hasQuestions),
      isComplete: Boolean(parsed.isComplete),
    };
  } catch {
    // Return raw text as message
    return {
      items: [],
      message: raw.substring(0, 500),
      hasQuestions: true,
      isComplete: false,
    };
  }
}

function detectImageMime(base64: string): string {
  // Check first few characters of base64 to determine format
  const head = base64.substring(0, 10);
  // JPEG starts with /9j/
  if (head.startsWith("/9j/")) return "image/jpeg";
  // PNG starts with iVBOR
  if (head.startsWith("iVBORw0KG")) return "image/png";
  // Default to JPEG
  return "image/jpeg";
}

function sanitizeBase64(base64: string): string {
  // Remove any data URL prefix if present, and any whitespace
  let cleaned = base64.replace(/^data:image\/\w+;base64,/, "").trim();
  // Remove newlines and spaces (sometimes added during copy/paste)
  cleaned = cleaned.replace(/[\s\n\r]+/g, "");
  return cleaned;
}

async function analyzeWithVision(
  imageBase64: string,
  mimeType: string,
  dataUri: string,
  promptText: string,
): Promise<string> {
  // Attempt 1: Hugging Face free serverless inference
  try {
    console.log("ai-meal-log: Trying HF Qwen VL...");
    const hf = createHFClient();
    const result = await hf.completeVision({
      systemPrompt: SYSTEM_PROMPT,
      imageBase64,
      imageMime: mimeType,
      userText: promptText,
      maxTokens: 1500,
      temperature: 0.3,
    });
    console.log("ai-meal-log: HF success —", result.content.length, "chars");
    return result.content;
  } catch (hfErr: any) {
    console.warn("ai-meal-log: HF failed —", hfErr?.message);
  }

  // Attempt 2: Groq — two-step: vision describes, text model structures
  console.log("ai-meal-log: Falling back to Groq 2-step...");

  // Step A: Vision model describes the food in natural language
  const groq = createGroqClient();
  const visionResult = await groq.completeVision({
    systemPrompt:
      "You are a nutritionist. Describe every food item visible in this meal photo in detail: what dish, estimated portion size, and visible ingredients. Be specific and factual. Do NOT output JSON — just plain natural language.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Describe every food item in this meal photo in detail — what each dish is, estimated portion size, and visible ingredients.",
          },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ],
    maxTokens: 800,
    temperature: 0.3,
  });

  const foodDescription = visionResult.content;
  console.log(
    "ai-meal-log: Vision description:",
    foodDescription.substring(0, 150),
    "...",
  );

  // Step B: Text model parses the description into structured JSON
  const jsonPrompt = `${SYSTEM_PROMPT}

The user provided this description of their meal:
"${foodDescription}"

Parse this into the JSON format. Estimate nutrition for each item based on the description. Output ONLY the JSON object.`;

  const jsonResult = await groq.complete({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: jsonPrompt }],
    maxTokens: 1200,
    temperature: 0.2,
  });

  console.log("ai-meal-log: JSON parser output length:", jsonResult.length);
  return jsonResult;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!checkRateLimit()) {
    return new Response(
      JSON.stringify(
        emptyResponse(
          "Daily AI query limit reached (50/day). Try again tomorrow.",
        ),
      ),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const rawImage = (body.image as string) || "";
    const text = (body.text as string)?.trim() || "";
    const conversation = body.conversation as
      | Array<{ role: string; content: string }>
      | undefined;
    const healthProfile = (body.healthProfile as string)?.trim() || "";
    const todayContext = (body.todayContext as string)?.trim() || "";

    const image = sanitizeBase64(rawImage);
    const hasImage = image.length > 100; // minimum length for a valid base64 image
    const hasConversation = conversation && conversation.length > 0;

    let response: string;

    if (hasImage) {
      console.log("ai-meal-log: processing image, length:", image.length);

      const contextBlock = [
        healthProfile ? `HEALTH PROFILE:\n${healthProfile}` : "",
        todayContext ? `TODAY'S FOOD LOG:\n${todayContext}` : "",
      ].filter(Boolean).join("\n\n");

      const promptText = contextBlock
        ? `${contextBlock}\n\nAnalyze this meal photo. Identify all food items and estimate nutrition. Output ONLY the JSON response.`
        : "Analyze this meal photo or product label. For food plates, identify all items and estimate nutrition. For package labels, read the nutrition facts table. Output ONLY the JSON response.";

      const mimeType = detectImageMime(image);
      const dataUri = `data:${mimeType};base64,${image}`;

      response = await analyzeWithVision(image, mimeType, dataUri, promptText);
    } else if (hasConversation) {
      const groqText = createGroqClient();
      const messages = conversation.map((m) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string"
          ? m.content
          : JSON.stringify(m.content),
      }));

      response = await groqText.complete({
        systemPrompt: SYSTEM_PROMPT,
        messages,
        maxTokens: 1500,
        temperature: 0.3,
      });
    } else if (text) {
      const groqText = createGroqClient();
      const contextBlock = [
        healthProfile ? `HEALTH PROFILE:\n${healthProfile}` : "",
        todayContext ? `TODAY'S FOOD LOG:\n${todayContext}` : "",
      ].filter(Boolean).join("\n\n");

      const userMessage = contextBlock
        ? `CONTEXT:\n${contextBlock}\n\nUSER'S MEAL DESCRIPTION:\n${text}\n\nAnalyze this meal description. Estimate nutrition for each item. Output ONLY the JSON response.`
        : `USER'S MEAL DESCRIPTION:\n${text}\n\nAnalyze this meal description. Estimate nutrition for each item. Output ONLY the JSON response.`;

      response = await groqText.complete({
        systemPrompt: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 1500,
        temperature: 0.3,
      });
    } else {
      return new Response(
        JSON.stringify(
          emptyResponse(
            "Please provide an image, text description, or conversation.",
          ),
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const parsed = parseResponse(response);

    return new Response(
      JSON.stringify(parsed),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ai-meal-log error:", err);
    const errorMessage = (err as Error).message || "Unknown error";
    console.error("ai-meal-log error details:", errorMessage);

    return new Response(
      JSON.stringify({
        items: [],
        message: `${errorMessage}`,
        hasQuestions: false,
        isComplete: true,
        error: errorMessage,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
