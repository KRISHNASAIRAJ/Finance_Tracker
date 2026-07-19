export interface SmsParseResult {
  id: string;
  senderId: string;
  body: string;
  amount: number | null;
  merchant: string | null;
  cardLast4: string | null;
  accountLast4: string | null;
  transactionType: 'debit' | 'credit' | null;
  confidence: number;
  bodyHash: string;
}

const BANK_SENDER_ALLOWLIST = new Set([
  'HDFCBK', 'HDFCCC', 'HDFC-BANK',
  'ICICIB', 'ICICIC', 'ICICI',
  'SBICRD', 'SBIBNK', 'SBIINB',
  'AXISBK', 'AXISCC', 'AXIS',
  'KOTAKB', 'KOTAKC', 'KOTAK',
  'INDUSB', 'INDUS',
  'YESBK', 'YESBNK',
  'PAYTMB', 'PAYTM',
]);

const OTP_PATTERNS = [
  /otp/i,
  /one[- ]?time[- ]?(?:password|code|pin)/i,
  /verification code/i,
  /login code/i,
  /is your (?:otp|code|password)/i,
  /do not share/i,
];

const AMOUNT_PATTERNS = [
  /(?:Rs\.?\s*|INR\s*|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:Rs\.?|INR|₹)/,
  /(?:debited|credited|spent|paid)\s+(?:for\s+)?(?:Rs\.?\s*|INR\s*|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/,
];

const CARD_LAST4_PATTERNS = [
  /card\s+(?:ending|no\.?\s*|number)?\s*[xX*]*(\d{4})/,
  /[xX]{4}\s*(\d{4})/,
  /ending\s+(?:with\s+)?(\d{4})/,
  /XX(\d{4})/,
];

const ACCOUNT_LAST4_PATTERNS = [
  /a\/c\s+[xX*]+(\d{4})/,
  /account\s+(?:no\.?\s*)?[xX*]+(\d{4})/,
  /acct\s+[xX*]+(\d{4})/,
  /A\/c\s+XX(\d{4})/,
];

const DEBIT_KEYWORDS = ['debited', 'spent', 'paid', 'purchase', 'withdrawn', 'deducted'];
const CREDIT_KEYWORDS = ['credited', 'received', 'refund', 'cashback', 'deposited'];

const MERCHANT_PATTERNS = [
  /at\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\s+for|\.|\s+Avl|\s+Bal)/,
  /to\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\s+for|\.|\s+Avl|\s+Bal)/,
  /for\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\.|\s+Avl|\s+Bal)/,
];

function hashBody(body: string): string {
  let hash = 0;
  for (let i = 0; i < body.length; i++) {
    const char = body.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function isOtpSms(body: string): boolean {
  return OTP_PATTERNS.some((p) => p.test(body));
}

function extractAmount(body: string): { amount: number | null; confidence: number } {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = pattern.exec(body);
    if (match) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        return { amount: Math.round(amount * 100), confidence: 0.95 };
      }
    }
  }
  return { amount: null, confidence: 0 };
}

function extractCardLast4(body: string): string | null {
  for (const pattern of CARD_LAST4_PATTERNS) {
    const match = pattern.exec(body);
    if (match) return match[1];
  }
  return null;
}

function extractAccountLast4(body: string): string | null {
  for (const pattern of ACCOUNT_LAST4_PATTERNS) {
    const match = pattern.exec(body);
    if (match) return match[1];
  }
  return null;
}

function extractTransactionType(body: string): { type: 'debit' | 'credit' | null; confidence: number } {
  const lower = body.toLowerCase();
  for (const kw of DEBIT_KEYWORDS) {
    if (lower.includes(kw)) return { type: 'debit', confidence: 0.9 };
  }
  for (const kw of CREDIT_KEYWORDS) {
    if (lower.includes(kw)) return { type: 'credit', confidence: 0.9 };
  }
  return { type: null, confidence: 0 };
}

function extractMerchant(body: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = pattern.exec(body);
    if (match) {
      const merchant = match[1].trim();
      if (merchant.length > 0 && merchant.length < 40) return merchant;
    }
  }
  return null;
}

export function isBankSender(senderId: string): boolean {
  return BANK_SENDER_ALLOWLIST.has(senderId.toUpperCase());
}

export function isFinancialSms(body: string): boolean {
  if (isOtpSms(body)) return false;
  const { amount } = extractAmount(body);
  const { type } = extractTransactionType(body);
  return amount !== null || type !== null;
}

export function shouldNotify(parsed: SmsParseResult | null): boolean {
  return parsed !== null && parsed.amount !== null && parsed.confidence >= 0.5;
}

export function parseSms(body: string): SmsParseResult | null {
  const { amount, confidence: amountConf } = extractAmount(body);
  const { type, confidence: typeConf } = extractTransactionType(body);

  if (!amount && !type) return null;

  const merchant = extractMerchant(body);
  const cardLast4 = extractCardLast4(body);
  const accountLast4 = extractAccountLast4(body);

  const confidence = Math.min(1, (amountConf + typeConf + (merchant ? 0.2 : 0)) / 2);

  return {
    id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderId: '',
    body,
    amount,
    merchant,
    cardLast4,
    accountLast4,
    transactionType: type,
    confidence,
    bodyHash: hashBody(body),
  };
}
