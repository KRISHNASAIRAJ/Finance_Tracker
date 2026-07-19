import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const RATE_LIMIT_KEY = 'meridian_sms_ai_calls';
const DAILY_LIMIT = 50;

export interface AiSmsParseResult {
  parsed: boolean;
  amount: number | null;
  merchant: string | null;
  card_last4: string | null;
  account_last4: string | null;
  transaction_type: 'debit' | 'credit' | null;
  confidence: number;
  source?: string;
  rate_limited?: boolean;
}

async function checkDailyLimit(): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const data: { date: string; count: number } = raw
      ? JSON.parse(raw)
      : { date: today, count: 0 };

    if (data.date !== today) {
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ date: today, count: 1 }));
      return true;
    }

    if (data.count >= DAILY_LIMIT) {
      return false;
    }

    data.count += 1;
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
    return true;
  } catch {
    return true;
  }
}

export async function callAiSmsParse(
  smsText: string,
  sender: string
): Promise<AiSmsParseResult> {
  const allowed = await checkDailyLimit();
  if (!allowed) {
    return {
      parsed: false,
      amount: null,
      merchant: null,
      card_last4: null,
      account_last4: null,
      transaction_type: null,
      confidence: 0,
      rate_limited: true,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-sms-parse', {
      body: { sms_text: smsText, sender },
    });

    if (error || !data) {
      return {
        parsed: false,
        amount: null,
        merchant: null,
        card_last4: null,
        account_last4: null,
        transaction_type: null,
        confidence: 0,
      };
    }

    return data as AiSmsParseResult;
  } catch {
    return {
      parsed: false,
      amount: null,
      merchant: null,
      card_last4: null,
      account_last4: null,
      transaction_type: null,
      confidence: 0,
    };
  }
}
