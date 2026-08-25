/**
 * smartParse — Windfall-style natural-language + bank-SMS transaction parsing
 * for the web. Mirrors mobile/src/modules/finance/smartParse.ts (offline, pure).
 * "lunch at starbucks 300 upi" or "Rs.5,000 debited from HDFC Bank on 12-Mar-25
 * via UPI" → { amount, notes, category, paymentMode, type, date }
 */

export type SmartPaymentMode = 'upi' | 'card' | 'cash' | 'bank'

export interface SmartParseResult {
  amount: number | null
  notes: string
  category: string
  paymentMode: SmartPaymentMode | null
  type: 'expense' | 'income'
  date: Date | null
}

const CURRENCY_MARKED_RE = /(?:₹|inr|rs\.?|rupees)\s*([\d][\d,]*(?:\.\d{1,2})?)/i
const MARKED_AFTER_RE = /([\d][\d,]*(?:\.\d{1,2})?)\s*(?:rs\.?|rupees)/i
const ANY_NUMBER_RE = /([\d][\d,]*(?:\.\d{1,2})?)/g
const CURRENCY_REMNANT_RE = /(?:₹|inr|rs\.?|rupees)\s*[\d][\d,]*(?:\.\d{1,2})?/gi
const PAYMENT_RE =
  /(upi|gpay|google\s*pay|phonepe|paytm|cash|credit\s*card|debit\s*card|card|netbanking|bank\s*transfer|neft|imps)/i
const INCOME_KEYWORDS = [
  'salary', 'paycheck', 'freelance', 'project payment', 'consulting',
  'interest', 'bonus', 'dividend', 'income', 'refund', 'cashback received',
  'credited', 'credit to', 'received', 'deposited', 'credited to',
]
const EXPENSE_KEYWORDS = ['debited', 'spent', 'used', 'swipe', 'purchase', 'paid', 'payment']
const DATE_HINT_RE = /(yesterday|last\s+night|tonight|today|day\s+before\s+yesterday)/i
const SMS_DATE_RE = /(\d{1,2})[/\-.\s]([A-Za-z]{3}|\d{1,2})[/\-.\s](\d{2,4})/
const BOILERPLATE_RE =
  /(available\s*bal(?:ance)?\s*[:.]?|avl(?:ailable)?\s*limit\s*[:.]?|ref(?:erence)?\s*(?:no\.?|id)?\s*[:.]?|txn\s*id\s*[:.]?|transaction\s*(?:id|ref)\s*[:.]?|a\/c\s*\w+|\w+\s+bank\s+a\/c\s*\w+)/gi
const MERCHANT_RE = /(?:used\s+at|spent\s+at|at|to)\s+([A-Za-z][A-Za-z0-9&.' ]{1,30})/i

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function parseSmsDate(text: string): Date | null {
  const m = SMS_DATE_RE.exec(text)
  if (!m) return null
  const day = parseInt(m[1], 10)
  let month: number
  let year: number
  if (/^[A-Za-z]{3}$/.test(m[2])) {
    const mm = MONTHS[m[2].toLowerCase()]
    if (mm === undefined) return null
    month = mm
  } else {
    month = parseInt(m[2], 10) - 1
  }
  year = parseInt(m[3], 10)
  if (year < 100) year += 2000
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  return new Date(year, month, day)
}

function autoDetectCategory(text: string, type: 'expense' | 'income'): string {
  const n = text.toLowerCase().trim()
  if (!n) return 'Others'
  if (type === 'income') {
    if (n.includes('salary') || n.includes('paycheck')) return 'Salary'
    if (n.includes('freelance') || n.includes('project') || n.includes('consulting')) return 'Freelance'
    return 'Others'
  }
  if (n.includes('instamart') || n.includes('zepto') || n.includes('blinkit') || n.includes('bigbasket') ||
    n.includes('amazonnow') || n.includes('grocery') || n.includes('kirana') ||
    n.includes('vegetables') || n.includes('market')) return 'Grocery'
  if (n.includes('swiggy') || n.includes('zomato') || n.includes('restaurant') || n.includes('food') ||
    n.includes('pizza') || n.includes('burger') || n.includes('cafe') || n.includes('tiffin') ||
    n.includes('lunch') || n.includes('dinner') || n.includes('breakfast') ||
    n.includes('dosa') || n.includes('biryani') || n.includes('idly') || n.includes('chapati') || n.includes('rice') ||
    n.includes('starbucks') || n.includes('coffee') || n.includes('tea') || n.includes('ccd') ||
    n.includes('costa') || n.includes('chaayos') || n.includes('chai'))
    return 'Food & Dining'
  if (n.includes('petrol') || n.includes('fuel') || n.includes('diesel') || n.includes('hp') ||
    n.includes('bpcl') || n.includes('ioc')) return 'Fuel'
  if (n.includes('rent') || n.includes('pg') || n.includes('apartment') || n.includes('flat')) return 'Rent'
  if (n.includes('amazon') || n.includes('flipkart') || n.includes('myntra') || n.includes('shopping') ||
    n.includes('mall') || n.includes('fashion')) return 'Shopping'
  if (n.includes('sip') || n.includes('mutual fund') || n.includes('mf')) return 'SIP'
  if (n.includes('equity') || n.includes('stock') || n.includes('share') || n.includes('zerodha') ||
    n.includes('kite') || n.includes('nse') || n.includes('bse')) return 'Equity Investment'
  if (n.includes('netflix') || n.includes('prime') || n.includes('hotstar') || n.includes('zee5') ||
    n.includes('sonyliv') || n.includes('jio cinema') || n.includes('ott')) return 'OTT'
  if (n.includes('youtube')) return 'Youtube Premium'
  if (n.includes('electricity') || n.includes('mobile') || n.includes('broadband') || n.includes('recharge') ||
    n.includes('bill') || n.includes('postpaid')) return 'Bills & Recharge'
  if (n.includes('emi') || n.includes('loan')) return 'EMI'
  if (n.includes('doctor') || n.includes('hospital') || n.includes('medicine') || n.includes('pharmacy') ||
    n.includes('clinic')) return 'Medical'
  if (n.includes('gym') || n.includes('health') || n.includes('wellness') || n.includes('yoga')) return 'Health & Wellness'
  if (n.includes('insurance') || n.includes('lic') || n.includes('policy')) return 'Insurance'
  if (n.includes('travel') || n.includes('flight') || n.includes('train') || n.includes('bus') ||
    n.includes('irctc') || n.includes('rapido') || n.includes('ola') || n.includes('uber') ||
    n.includes('metro')) return 'Travel'
  if (n.includes('movie') || n.includes('bookmyshow') || n.includes('pvr') || n.includes('inox') ||
    n.includes('entertainment')) return 'Entertainment'
  if (n.includes('card') && (n.includes('annual') || n.includes('fee') || n.includes('charge'))) return 'Card Annual Charges'
  if (n.includes('education') || n.includes('course') || n.includes('udemy') || n.includes('book') ||
    n.includes('school') || n.includes('college')) return 'Education'
  if (n.includes('atm') || n.includes('withdraw') || n.includes('cash')) return 'Cash Withdrawal'
  if (n.includes('paytm') || n.includes('phonepe') || n.includes('gpay') || n.includes('wallet') ||
    n.includes('payzapp') || n.includes('pazapp')) return 'Wallet Loads'
  if (n.includes('cleaning') || n.includes('plumbing') || n.includes('electrician') || n.includes('repair'))
    return 'Professional Service'
  return 'Others'
}

function parseNumberToken(token: string): number | null {
  const cleaned = token.replace(/,/g, '')
  const val = parseFloat(cleaned)
  return isNaN(val) ? null : val
}

export function smartParse(text: string): SmartParseResult {
  const input = (text || '').trim()
  const result: SmartParseResult = {
    amount: null,
    notes: '',
    category: 'Others',
    paymentMode: null,
    type: 'expense',
    date: null,
  }
  if (!input) return result

  const lower = input.toLowerCase()

  // 1. Income vs expense — income keywords win, else expense keywords force expense
  const isIncome = INCOME_KEYWORDS.some((k) => lower.includes(k))
  const isExpense = EXPENSE_KEYWORDS.some((k) => lower.includes(k))
  result.type = isIncome && !isExpense ? 'income' : 'expense'

  // 2. Amount — prefer the first currency-marked value, else the last number
  const currencyMatch = CURRENCY_MARKED_RE.exec(input) ?? MARKED_AFTER_RE.exec(input)
  let amountRaw: string | null = null
  if (currencyMatch) {
    amountRaw = currencyMatch[1] ?? currencyMatch[2]
  } else {
    const all = [...input.matchAll(ANY_NUMBER_RE)]
    if (all.length > 0) amountRaw = all[all.length - 1][1]
  }
  if (amountRaw) {
    const val = parseNumberToken(amountRaw)
    if (val !== null && val >= 0) result.amount = val
  }

  // 3. Date — SMS dates first, then relative hints. Remove the date text from remaining.
  const smsDate = parseSmsDate(input)
  const dateMatch = DATE_HINT_RE.exec(lower)
  let remaining = input
  if (smsDate) {
    result.date = smsDate
    const smsDateMatch = SMS_DATE_RE.exec(input)
    if (smsDateMatch) {
      remaining = remaining.replace(smsDateMatch[0], ' ').trim()
    }
  } else if (dateMatch) {
    const hint = dateMatch[1].toLowerCase()
    const d = new Date()
    if (hint.includes('yesterday') || hint === 'last night') d.setDate(d.getDate() - 1)
    else if (hint === 'day before yesterday') d.setDate(d.getDate() - 2)
    result.date = d
    remaining = remaining.replace(new RegExp(dateMatch[0], 'gi'), ' ').trim()
  }

  // 4. Payment mode
  const payMatch = PAYMENT_RE.exec(lower)
  if (payMatch) {
    const p = payMatch[1].toLowerCase()
    if (p.includes('upi') || p.includes('gpay') || p.includes('google') || p.includes('phonepe') || p.includes('paytm')) {
      result.paymentMode = 'upi'
    } else if (p.includes('card')) {
      result.paymentMode = 'card'
    } else if (p.includes('cash')) {
      result.paymentMode = 'cash'
    } else {
      result.paymentMode = 'bank'
    }
    remaining = remaining.replace(new RegExp(payMatch[0], 'gi'), ' ').trim()
  }

  // 5. Merchant extraction (bank SMS: "used at SWIGGY", "to STARBUCKS COFFEE")
  const merchantMatch = MERCHANT_RE.exec(remaining)
  let merchant = ''
  if (merchantMatch && !/bank|account|limit|balance/i.test(merchantMatch[1])) {
    merchant = merchantMatch[1].trim().replace(/\s+/g, ' ')
    remaining = remaining.replace(merchantMatch[0], ' ').trim()
  }

  // 6. Remove the amount token(s) from the remaining text
  if (amountRaw) {
    const amountAsInText = [...remaining.matchAll(ANY_NUMBER_RE)]
    for (const m of amountAsInText) {
      if (parseNumberToken(m[1]) === result.amount) {
        remaining = remaining.replace(m[0], ' ').trim()
        break
      }
    }
    remaining = remaining.replace(/[₹,]/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // 7. Strip bank-SMS boilerplate, currency remnants and collapse whitespace
  let notes = remaining
    .replace(/\b(?:debited|credited|spent|used|swiped)\b/gi, ' ')
    .replace(BOILERPLATE_RE, ' ')
    .replace(CURRENCY_REMNANT_RE, ' ')
    .replace(/\brs\.?/gi, ' ')
    .replace(/[₹]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (merchant) {
    notes = notes ? `${merchant} ${notes}` : merchant
  }
  result.notes = notes || input.trim()
  result.category = autoDetectCategory(result.notes || input, result.type)
  return result
}
