/**
 * ai-sms-parse Edge Function
 *
 * Phase 5: SMS parsing fallback — when the on-device regex rules engine fails
 * or returns low confidence, this function sends sanitized SMS text to Groq
 * (free tier, Llama 3) for structured extraction.
 *
 * Deploy: supabase functions deploy ai-sms-parse
 * Secrets: supabase secrets set GROQ_API_KEY=gsk_...
 *
 * Rate limit: 50 calls/day enforced on mobile side
 */

const GROQ_MODEL = "llama-3.1-8b-instant";

function sanitizeSmsText(text: string): string {
  return text
    .replace(/\b\d{10,12}\b/g, "[PHONE]")
    .replace(/[\w.]+@[\w.]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g, "[PAN]")
    .replace(/\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g, "[AADHAAR]");
}

const SYSTEM_PROMPT = `You are an SMS parser for Indian bank transaction messages.
Extract structured data from the sanitized SMS text provided.
Return ONLY valid JSON. Do not include any explanation or markdown.

Output schema:
{
  "amount": <integer paise, null if not found>,
  "merchant": <string or null>,
  "card_last4": <4-digit string or null>,
  "account_last4": <4-digit string or null>,
  "transaction_type": <"debit" | "credit" | null>,
  "confidence": <float 0.0-1.0>
}

Rules:
- amount is in PAISE (multiply rupees by 100)
- merchant is the business/payee name only, not the bank name
- merchant should be short and clean (e.g., "Swiggy" not "SWIGGY ORDER ON...")
- card_last4 is exactly 4 digits from credit card references
- account_last4 is exactly 4 digits from bank account references
- confidence reflects how certain you are of the extraction
- if the message is not a transaction, set all fields to null and confidence to 0`;

async function callGroq(content: string): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY") ?? "";
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_tokens: 256,
      temperature: 0,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Groq API error: ${resp.status} ${await resp.text()}`);
  }

  const body = await resp.json();
  return body.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const { sms_text, sender } = await req.json();

    if (!sms_text) {
      return new Response(
        JSON.stringify({ error: "sms_text required" }),
        { status: 400, headers }
      );
    }

    const sanitized = sanitizeSmsText(sms_text);
    const truncated = sanitized.length > 1000 ? sanitized.slice(0, 1000) : sanitized;

    const response = await callGroq(
      `Parse this bank SMS:\n${truncated}\n\nSender: ${sender || "unknown"}`
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({
          parsed: false,
          amount: null,
          merchant: null,
          card_last4: null,
          account_last4: null,
          transaction_type: null,
          confidence: 0,
        }),
        { status: 200, headers }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const confidence =
      typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;

    return new Response(
      JSON.stringify({
        parsed: true,
        amount: typeof parsed.amount === "number" ? Math.round(parsed.amount) : null,
        merchant: typeof parsed.merchant === "string" ? parsed.merchant : null,
        card_last4: typeof parsed.card_last4 === "string" ? parsed.card_last4 : null,
        account_last4: typeof parsed.account_last4 === "string" ? parsed.account_last4 : null,
        transaction_type:
          parsed.transaction_type === "debit" || parsed.transaction_type === "credit"
            ? parsed.transaction_type
            : null,
        confidence,
        source: "groq",
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        parsed: false,
        amount: null,
        merchant: null,
        card_last4: null,
        account_last4: null,
        transaction_type: null,
        confidence: 0,
        error: (err as Error).message,
      }),
      { status: 200, headers }
    );
  }
});
