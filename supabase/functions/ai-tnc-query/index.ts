/**
 * ai-tnc-query Edge Function
 *
 * Phase 6: Card T&C RAG chat — two modes:
 * 1. General: answers from built-in card knowledge base (CARD_KNOWLEDGE)
 * 2. Document RAG: retrieves user-uploaded card document from DB, uses it as context
 *
 * Deploy: supabase functions deploy ai-tnc-query
 * Secrets: supabase secrets set GROQ_API_KEY=gsk_...
 */

import { createGroqClient } from "../_shared/groq.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CARD_KNOWLEDGE = `## Credit Card Database

### SBI Cashback Card
- Bank: SBI | Network: VISA | Annual Fee: ₹999 (waived on ₹2L spend)
- Rewards: 5% cashback on ALL online spends (cap: ₹2,000/month). 1% on offline.
- Exclusions: Fuel, wallet loads, rent, jewelry, education, utility, insurance, railway, toll, government, gaming
- Forex markup: 3.5%. Fuel surcharge: 1% waiver (tx ₹500-3,000)
- Best for: Online shopping (Amazon, Flipkart, Myntra, Swiggy, Zomato, etc.)

### SBI SimplySAVE
- Bank: SBI | Network: RuPay | Annual Fee: ₹499 (waived on ₹1L spend)
- Rewards: 10X points on Dining (2.5%), Grocery (2.5%), Movies (2.5%), Department Stores (2.5%). 0.25% on other.
- Monthly cap: ₹5,000 on 10X bonus categories. Points expire in 24 months. 1 RP = ₹0.25.
- Exclusions: Fuel
- Forex markup: 3.5%. Fuel surcharge: 1% waiver (tx ₹500-3,000)
- Welcome: 2,000 RP on ₹2,000 spend in 60 days

### IDFC Power+
- Bank: IDFC FIRST | Network: RuPay | Annual Fee: ₹499 (waived on ₹50K spend)
- Rewards: 5.42% on HPCL fuel via HP Pay (5% + 1.5% Happy Coins - 1.08% surcharge). 5% on Grocery & Utility (cap: ₹2,000/month). 5% on IDFC FASTag (cap: ₹1,000). 0.5% on other retail/UPI.
- Fuel cap: ₹12,000/statement. Fuel surcharge: standard 1% waiver.
- Exclusions: Insurance, EMI, Cash Advance. Forex markup: 0%.
- Best for: Fuel at HPCL pumps. Use HP Pay QR or wallet upload for max 5.4% net rewards.

### Amazon Pay ICICI
- Bank: ICICI | Network: VISA | Lifetime Free (₹0 fee)
- Rewards: 5% for Amazon Prime members (3% non-Prime) on Amazon.in. 2% on partner merchants (Swiggy, Zomato, Flipkart, Myntra, BookMyShow, Uber, Ola). 1% on other.
- Exclusions: Fuel >₹10K, Utility >₹50K, Rent, Wallet, 3rd-party Education
- Forex markup: 3.5%. Fuel surcharge: 1% waiver.
- Best for: Amazon shoppers. Cashback as Amazon Pay balance.

### HSBC Platinum RuPay
- Bank: HSBC | Network: RuPay | Lifetime Free (₹0 fee)
- Rewards: 0% on all spends. No rewards earned.
- Notes: Namesake card only — not recommended for any spend.

### CRED IndusInd
- Bank: IndusInd | Network: RuPay | Annual Fee: ₹499
- Rewards: Up to 3X RP on UPI spends. CRED partnership.
- Exclusions: N/A. Forex markup: 3.5%.
- Notes: CRED partnership card. UPI-linked RuPay. Reward redemption fee exempt for CRED users.

### Slice Card
- Bank: Slice / RBL | Network: RuPay | Lifetime Free (₹0 fee)
- Rewards: 1 monies per ₹1 on UPI & card spends (effectively 1%).
- Exclusions: EMI, Wallet, Fuel, Insurance, Rent, Education, Taxes, Government, Gaming, International
- Forex markup: 0%. No fuel surcharge waiver.
- Notes: UPI + card combo. Monies redeemable to Slice savings account. Best for UPI spends.

### Pazapp Card
- Bank: South Indian Bank | Network: VISA | Lifetime Free (₹0 fee)
- Rewards: 2% cashback on online spends (cap: ₹200/month). 1% on offline (cap: ₹200/month).
- Exclusions: Fuel, Wallet, Rent. Forex markup: 3.5%.
- Notes: Limited caps. Good for small online spends.

### Load Card
- Bank: Other | Network: VISA | Lifetime Free (₹0 fee)
- Rewards: Flat 1% cashback on all spends. No caps.
- Exclusions: Fuel, Wallet. Forex markup: 3.5%.

## Key Rules
- All amounts in ₹ (Indian Rupees)
- UPI transactions only work with RuPay network cards (Slice, CRED IndusInd, SBI SimplySAVE, IDFC Power+, HSBC Platinum)
- Visa and Mastercard cards cannot be used for UPI payments
- Cashback is credited to statement. Monies/Points redeem as per bank policy.
- Fuel surcharge: typically 1% + GST on fuel transactions. Many cards waive this.
- Forex transactions attract a markup % over VISA/Mastercard exchange rate.
- Annual fees may be waived if annual spend threshold is met.`;

const GENERAL_SYSTEM_PROMPT = `You are a credit card rewards expert for Indian cards. Answer user questions based ONLY on the card database provided below. Be concise and specific. If the answer is not in the database, say "I don't have that information in my database." Always mention any caps, exclusions, or conditions that apply.

At the end of every response, add this disclaimer in italic: "_Based on publicly available card information — verify with your bank for current terms._"

${CARD_KNOWLEDGE}`;

const DOCUMENT_SYSTEM_PROMPT = `You are a credit card terms and conditions analyst. The user has uploaded a card T&C document. Answer their question based ONLY on the document content provided below. Be precise and cite specific sections when possible.

If the document doesn't contain the answer, say "The uploaded document doesn't cover this specific scenario." Do not make up information.

At the end of every response, add this disclaimer in italic: "_Based on your uploaded document — verify with your bank for current terms._"`;

function buildDocumentPrompt(query: string, documentText: string): string {
  const truncated = documentText.length > 8000 ? documentText.slice(0, 8000) + "\n\n[... document truncated ...]" : documentText;
  return `Document Content:\n"""\n${truncated}\n"""\n\nUser Question: ${query}\n\nAnswer the question using only the document above.`;
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
    const { query, document_id } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "query required" }),
        { status: 400, headers }
      );
    }

    const groq = createGroqClient();
    let answer: string;

    // Mode: Document RAG (if document_id provided)
    if (document_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

      if (!supabaseUrl || !supabaseKey) {
        return new Response(
          JSON.stringify({ error: "Database not configured" }),
          { status: 500, headers }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: doc, error: dbErr } = await supabase
        .from("card_documents")
        .select("content, card_name")
        .eq("id", document_id)
        .single();

      if (dbErr || !doc) {
        return new Response(
          JSON.stringify({ error: "Document not found", answer: "The requested document could not be found." }),
          { status: 200, headers }
        );
      }

      const userPrompt = buildDocumentPrompt(query.trim(), doc.content);

      answer = await groq.complete({
        systemPrompt: DOCUMENT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 768,
        temperature: 0.3,
      });
    } else {
      // Mode: General card knowledge
      answer = await groq.complete({
        systemPrompt: GENERAL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: query.trim() }],
        maxTokens: 512,
        temperature: 0.3,
      });
    }

    return new Response(
      JSON.stringify({
        answer: answer.trim(),
        disclaimer: groq.DISCLAIMER_TNC,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: (err as Error).message,
        answer: "Sorry, I couldn't process your question. Please try again.",
        disclaimer: "Based on publicly available card information — verify with your bank for current terms.",
      }),
      { status: 500, headers }
    );
  }
});
