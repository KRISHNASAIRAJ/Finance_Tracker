import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const RATE_LIMIT_KEY_TNC = 'meridian_ai_tnc_calls';
const DAILY_LIMIT_TNC = 30;

async function checkDailyLimit(key: string, limit: number): Promise<boolean> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = await AsyncStorage.getItem(key);
    const data: { date: string; count: number } = raw
      ? JSON.parse(raw)
      : { date: today, count: 0 };
    if (data.date !== today) {
      await AsyncStorage.setItem(key, JSON.stringify({ date: today, count: 1 }));
      return true;
    }
    if (data.count >= limit) {
      return false;
    }
    data.count += 1;
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return true;
  }
}

export interface CardTnCResponse {
  answer: string;
  disclaimer: string;
  error?: string;
}

export async function askCardTnC(query: string, documentId?: string): Promise<CardTnCResponse> {
  const allowed = await checkDailyLimit(RATE_LIMIT_KEY_TNC, DAILY_LIMIT_TNC);
  if (!allowed) {
    return {
      answer: 'You\'ve reached the daily AI query limit (30/day). Try again tomorrow.',
      disclaimer: 'Based on publicly available card information.',
    };
  }

  try {
    const body: any = { query };
    if (documentId) {
      body.document_id = documentId;
    }

    const { data, error } = await supabase.functions.invoke('ai-tnc-query', {
      body,
    });

    if (error || !data) {
      return {
        answer: 'Sorry, I couldn\'t process your question. Please try again.',
        disclaimer: 'Based on publicly available card information.',
        error: error?.message,
      };
    }

    return data as CardTnCResponse;
  } catch (e: any) {
    return {
      answer: 'Sorry, the AI service is temporarily unavailable.',
      disclaimer: 'Based on publicly available card information.',
      error: e?.message,
    };
  }
}

interface PortfolioHolding {
  symbol?: string;
  name?: string;
  type: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  allocation?: string;
}

interface PortfolioGoal {
  name: string;
  target: number;
  current: number;
  dueDate?: string;
}

export interface PortfolioRecResponse {
  summary: string;
  recommendations: Array<{
    action: string;
    asset: string;
    reason: string;
    priority: string;
  }>;
  disclaimer: string;
  error?: string;
}

export async function askPortfolioRecommend(
  holdings: PortfolioHolding[],
  goals: PortfolioGoal[]
): Promise<PortfolioRecResponse> {
  const allowed = await checkDailyLimit('meridian_ai_portfolio_calls', 10);
  if (!allowed) {
    return {
      summary: 'You\'ve reached the daily portfolio recommendation limit (10/day).',
      recommendations: [],
      disclaimer: 'For informational purposes only. This is not investment advice.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-portfolio-recommend', {
      body: { holdings, goals },
    });

    if (error || !data) {
      return {
        summary: 'Sorry, I couldn\'t analyze your portfolio. Please try again.',
        recommendations: [],
        disclaimer: 'For informational purposes only. This is not investment advice.',
        error: error?.message,
      };
    }

    return data as PortfolioRecResponse;
  } catch (e: any) {
    return {
      summary: 'Sorry, the AI service is temporarily unavailable.',
      recommendations: [],
      disclaimer: 'For informational purposes only. This is not investment advice.',
      error: e?.message,
    };
  }
}
