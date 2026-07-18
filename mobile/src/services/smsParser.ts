export interface SmsParseResult {
  amount: number | null;
  merchant: string | null;
  cardLast4: string | null;
  accountLast4: string | null;
  transactionType: 'debit' | 'credit' | null;
  confidence: number;
  source: 'regex';
}

const BANK_SENDER_ALLOWLIST = [
  'HDFCBK', 'HDFCCC', 'HDFC-BANK',
  'ICICIB', 'ICICIC', 'ICICI',
  'SBICRD', 'SBIBNK', 'SBIINB',
  'AXISBK', 'AXISCC', 'AXIS',
  'KOTAKB', 'KOTAKC', 'KOTAK',
  'INDUSB', 'INDUS',
  'YESBK', 'YESBNK',
  'PAYTMB', 'PAYTM',
];

const AMOUNT_PATTERNS = [
  /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:Rs\.?|INR|₹)/i,
  /(?:debited|credited|spent|paid)\s+(?:for\s+)?(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

const CARD_LAST4_PATTERNS = [
  /card\s+(?:ending|no\.?|number)?\s*[xX*]+(\d{4})/i,
  /[xX]{4}\s*(\d{4})/,
  /ending\s+(?:with\s+)?(\d{4})/i,
];

const ACCOUNT_LAST4_PATTERNS = [
  /a\/c\s+[xX*]+(\d{4})/i,
  /account\s+(?:no\.?\s*)?[xX*]+(\d{4})/i,
  /acct\s+[xX*]+(\d{4})/i,
];

const DEBIT_KEYWORDS = ['debited', 'spent', 'paid', 'purchase', 'withdrawn', 'deducted'];
const CREDIT_KEYWORDS = ['credited', 'received', 'refund', 'cashback', 'deposited'];

const MERCHANT_PATTERNS = [
  /at\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\s+for|\.|$)/i,
  /to\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\s+for|\.|$)/i,
  /for\s+([A-Za-z0-9\s&\-\.]+?)(?:\s+on|\s+via|\.|$)/i,
];

const NON_FINANCIAL_PATTERNS = [
  /OTP/i,
  /one.time.password/i,
  /verification code/i,
  /login/i,
  /your OTP/i,
];

export function isBankSender(senderId: string): boolean {
  const upper = senderId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return BANK_SENDER_ALLOWLIST.some((s) => upper.includes(s));
}

export function isFinancialSms(body: string): boolean {
  const hasAmount = AMOUNT_PATTERNS.some((p) => p.test(body));
  const hasTransaction = [...DEBIT_KEYWORDS, ...CREDIT_KEYWORDS].some((kw) =>
    body.toLowerCase().includes(kw)
  );
  const isOtp = NON_FINANCIAL_PATTERNS.some((p) => p.test(body));
  return (hasAmount || hasTransaction) && !isOtp;
}

function parseAmount(text: string): { amount: number | null; confidence: number } {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, '');
      const parsed = parseFloat(amountStr);
      if (!isNaN(parsed)) {
        return { amount: Math.round(parsed * 100), confidence: 0.95 };
      }
    }
  }
  return { amount: null, confidence: 0 };
}

function parseCardLast4(text: string): string | null {
  for (const pattern of CARD_LAST4_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseAccountLast4(text: string): string | null {
  for (const pattern of ACCOUNT_LAST4_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function determineTransactionType(text: string): { type: 'debit' | 'credit' | null; confidence: number } {
  const lower = text.toLowerCase();
  for (const kw of DEBIT_KEYWORDS) {
    if (lower.includes(kw)) return { type: 'debit', confidence: 0.9 };
  }
  for (const kw of CREDIT_KEYWORDS) {
    if (lower.includes(kw)) return { type: 'credit', confidence: 0.9 };
  }
  return { type: null, confidence: 0 };
}

function parseMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].trim();
      const cleaned = raw
        .replace(/UPI\s*\/?\s*/gi, '')
        .replace(/ref\s*no\.?\s*\w*/gi, '')
        .trim();
      if (cleaned.length > 1) return cleaned;
    }
  }
  return null;
}

export function parseSms(body: string): SmsParseResult {
  const { amount, confidence: amountConf } = parseAmount(body);
  const { type, confidence: typeConf } = determineTransactionType(body);
  const cardLast4 = parseCardLast4(body);
  const accountLast4 = parseAccountLast4(body);
  const merchant = parseMerchant(body);

  let confidence = 0;
  if (amount !== null) confidence += 0.4;
  if (type !== null) confidence += 0.3;
  if (merchant !== null) confidence += 0.2;
  if (cardLast4 || accountLast4) confidence += 0.1;

  return {
    amount,
    merchant,
    cardLast4,
    accountLast4,
    transactionType: type,
    confidence: Math.round(confidence * 100) / 100,
    source: 'regex',
  };
}

export function shouldNotify(result: SmsParseResult): boolean {
  return result.confidence >= 0.5 && result.amount !== null;
}
