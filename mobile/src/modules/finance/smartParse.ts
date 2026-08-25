/**
 * smartParse — Windfall-style natural-language transaction parsing.
 * Turns "lunch at starbucks 300 upi" into { amount, notes, category, mode, type, date }
 * so the Add Transaction screen can review the result before saving.
 * Pure + offline — no AI calls (offline-first rule).
 */
import { autoDetectCategory } from '../../shared/categoryMap';

export type SmartPaymentMode = 'upi' | 'card' | 'cash' | 'bank';

export interface SmartParseResult {
  amount: number | null; // in rupees (float), null if not found
  notes: string;
  category: string;
  paymentMode: SmartPaymentMode | null;
  type: 'expense' | 'income';
  date: Date | null; // null = use today/now
}

const CURRENCY_MARKED_RE = /(?:₹|rs\.?|rupees)\s*([\d][\d,]*(?:\.\d{1,2})?)/i;
const MARKED_AFTER_RE = /([\d][\d,]*(?:\.\d{1,2})?)\s*(?:rs\.?|rupees)/i;
const ANY_NUMBER_RE = /([\d][\d,]*(?:\.\d{1,2})?)/g;

const PAYMENT_RE =
  /(upi|gpay|google\s*pay|phonepe|paytm|cash|credit\s*card|debit\s*card|card|netbanking|bank\s*transfer|neft|imps)/i;

const INCOME_KEYWORDS = [
  'salary', 'paycheck', 'freelance', 'project payment', 'consulting',
  'interest', 'bonus', 'dividend', 'income', 'refund', 'cashback received',
];

const DATE_HINT_RE = /(yesterday|last\s+night|tonight|today|day\s+before\s+yesterday)/i;

function parseNumberToken(token: string): number | null {
  const cleaned = token.replace(/,/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

export function smartParse(text: string): SmartParseResult {
  const input = (text || '').trim();
  const result: SmartParseResult = {
    amount: null,
    notes: '',
    category: 'Others',
    paymentMode: null,
    type: 'expense',
    date: null,
  };
  if (!input) return result;

  const lower = input.toLowerCase();

  // 1. Income vs expense
  result.type = INCOME_KEYWORDS.some((k) => lower.includes(k)) ? 'income' : 'expense';

  // 2. Amount — prefer currency-marked, else the last standalone number
  const currencyMatch = CURRENCY_MARKED_RE.exec(input) ?? MARKED_AFTER_RE.exec(input);
  let amountRaw: string | null = null;
  if (currencyMatch) {
    amountRaw = currencyMatch[1] ?? currencyMatch[2];
  } else {
    const all = [...input.matchAll(ANY_NUMBER_RE)];
    if (all.length > 0) {
      amountRaw = all[all.length - 1][1];
    }
  }
  if (amountRaw) {
    const val = parseNumberToken(amountRaw);
    if (val !== null && val >= 0) {
      result.amount = val;
    }
  }

  // 3. Date hint
  const dateMatch = DATE_HINT_RE.exec(lower);
  let remaining = input;
  if (dateMatch) {
    const hint = dateMatch[1].toLowerCase();
    const d = new Date();
    if (hint.includes('yesterday') || hint === 'last night') d.setDate(d.getDate() - 1);
    else if (hint === 'day before yesterday') d.setDate(d.getDate() - 2);
    result.date = d;
    remaining = remaining.replace(new RegExp(dateMatch[0], 'gi'), ' ').trim();
  }

  // 4. Payment mode
  const payMatch = PAYMENT_RE.exec(lower);
  if (payMatch) {
    const p = payMatch[1].toLowerCase();
    if (p.includes('upi') || p.includes('gpay') || p.includes('google') || p.includes('phonepe') || p.includes('paytm')) {
      result.paymentMode = 'upi';
    } else if (p.includes('card')) {
      result.paymentMode = 'card';
    } else if (p.includes('cash')) {
      result.paymentMode = 'cash';
    } else {
      result.paymentMode = 'bank';
    }
    remaining = remaining.replace(new RegExp(payMatch[0], 'gi'), ' ').trim();
  }

  // 5. Remove the amount token(s) from the remaining text
  if (amountRaw) {
    const amountAsInText = [...remaining.matchAll(ANY_NUMBER_RE)];
    for (const m of amountAsInText) {
      if (parseNumberToken(m[1]) === result.amount) {
        remaining = remaining.replace(m[0], ' ').trim();
        break;
      }
    }
    // Fallback: strip any currency symbol remaining
    remaining = remaining.replace(/[₹,]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  result.notes = remaining.replace(/[₹]/g, ' ').replace(/\s+/g, ' ').trim();
  result.category = autoDetectCategory(result.notes || input, result.type);
  return result;
}
