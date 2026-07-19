import { parseSms, isBankSender, isFinancialSms, shouldNotify } from '../smsParser';

describe('isBankSender', () => {
  it('matches known bank sender IDs', () => {
    expect(isBankSender('HDFCBK')).toBe(true);
    expect(isBankSender('ICICIB')).toBe(true);
    expect(isBankSender('SBICRD')).toBe(true);
    expect(isBankSender('AXISBK')).toBe(true);
    expect(isBankSender('KOTAKB')).toBe(true);
    expect(isBankSender('PAYTMB')).toBe(true);
  });

  it('rejects non-bank senders', () => {
    expect(isBankSender('GP-Google')).toBe(false);
    expect(isBankSender('Flipkart')).toBe(false);
    expect(isBankSender('')).toBe(false);
  });
});

describe('isFinancialSms', () => {
  it('detects financial messages', () => {
    expect(isFinancialSms('Rs 500 debited from account')).toBe(true);
    expect(isFinancialSms('INR 1200 credited to A/c')).toBe(true);
    expect(isFinancialSms('₹850 spent at Swiggy')).toBe(true);
  });

  it('rejects OTP messages', () => {
    expect(isFinancialSms('Your OTP is 123456')).toBe(false);
    expect(isFinancialSms('OTP 987654 for login')).toBe(false);
    expect(isFinancialSms('do not share your OTP')).toBe(false);
  });
});

describe('parseSms', () => {
  it('parses HDFC credit card SMS', () => {
    const result = parseSms('Rs.450.00 spent on HDFC Bank Credit Card ending 1234 at SWIGGY ORDER on 17-07-26. Avl Lmt: Rs.49550.');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(45000);
    expect(result!.cardLast4).toBe('1234');
    expect(result!.transactionType).toBe('debit');
    expect(result!.merchant).toBe('SWIGGY ORDER');
    expect(result!.confidence).toBeGreaterThan(0.7);
  });

  it('parses HDFC bank debit SMS', () => {
    const result = parseSms('Rs 1500 debited from A/c XX9876 on 17-Jul-26 to UPI/MERCHANT/ref. Bal:Rs 23,450');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(150000);
    expect(result!.accountLast4).toBe('9876');
    expect(result!.transactionType).toBe('debit');
  });

  it('parses ICICI credit card SMS', () => {
    const result = parseSms('ICICI Bank Credit Card XX5678: Rs 2999.00 spent at AMAZON on 17-Jul-2026.');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(299900);
    expect(result!.cardLast4).toBe('5678');
  });

  it('parses SBI debit SMS', () => {
    const result = parseSms('Your A/c no. XX4321 is debited by INR 500.00 on 17-07-26');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(50000);
    expect(result!.accountLast4).toBe('4321');
  });

  it('parses Axis bank SMS with ₹ symbol', () => {
    const result = parseSms('₹850 debited from Axis Bank A/c ending 2345 for ZOMATO on 17Jul26');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(85000);
    expect(result!.merchant).toBe('ZOMATO');
  });

  it('parses Kotak credit card SMS', () => {
    const result = parseSms('Kotak Bank: Rs.1200 spent using your credit card XX7890 at MYNTRA on 17-Jul-2026.');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(120000);
    expect(result!.cardLast4).toBe('7890');
  });

  it('parses credit/refund SMS', () => {
    const result = parseSms('Rs 500 credited to A/c XX1111 as cashback');
    expect(result).not.toBeNull();
    expect(result!.transactionType).toBe('credit');
  });

  it('returns null for non-transaction messages', () => {
    expect(parseSms('Hello, your bill is ready')).toBeNull();
    expect(parseSms('Your package has been shipped')).toBeNull();
  });
});

describe('shouldNotify', () => {
  it('returns true for high-confidence parse', () => {
    const parsed = parseSms('Rs 500 debited from account');
    expect(shouldNotify(parsed)).toBe(true);
  });

  it('returns false for null parse', () => {
    expect(shouldNotify(null)).toBe(false);
  });
});
