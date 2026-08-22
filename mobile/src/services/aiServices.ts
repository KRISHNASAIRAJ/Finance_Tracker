/**
 * aiServices — Groq-backed AI assistants: Card T&C Q&A and portfolio recommendations with rate limiting.
 */
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

export async function askCardTnC(query: string, documentId?: string, transactionsCtx?: string, financeCtx?: string): Promise<CardTnCResponse> {
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
    if (transactionsCtx) {
      body.transactions_ctx = transactionsCtx;
    }
    if (financeCtx) {
      body.finance_ctx = financeCtx;
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

export interface MealFoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealAnalysisResult {
  items: MealFoodItem[];
  message: string;
  hasQuestions: boolean;
  isComplete: boolean;
  error?: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const RATE_LIMIT_KEY_MEAL = 'meridian_ai_meal_calls';
const DAILY_LIMIT_MEAL = 50;

export async function analyzeMealImage(
  base64Image: string,
  conversation?: ConversationTurn[],
  healthProfile?: string,
  todayContext?: string,
): Promise<MealAnalysisResult> {
  const allowed = await checkDailyLimit(RATE_LIMIT_KEY_MEAL, DAILY_LIMIT_MEAL);
  if (!allowed) {
    return { items: [], message: 'Daily AI query limit reached (50/day). Try again tomorrow.', hasQuestions: false, isComplete: true };
  }

  try {
    const body: Record<string, unknown> = {
      image: base64Image,
      healthProfile: healthProfile || '',
      todayContext: todayContext || '',
    };
    if (conversation && conversation.length > 0) {
      body.conversation = conversation;
    }

    const { data, error } = await supabase.functions.invoke('ai-meal-log', { body });

    if (error || !data) {
      const errMsg = error?.message || 'No data returned';
      return { items: [], message: `AI analysis failed: ${errMsg}`, hasQuestions: false, isComplete: true, error: errMsg };
    }

    return data as MealAnalysisResult;
  } catch (e: any) {
    return { items: [], message: `AI service error: ${e?.message || 'Unknown error'}`, hasQuestions: false, isComplete: true, error: e?.message };
  }
}

export async function analyzeMealText(
  description: string,
  conversation?: ConversationTurn[],
  healthProfile?: string,
  todayContext?: string,
): Promise<MealAnalysisResult> {
  const allowed = await checkDailyLimit(RATE_LIMIT_KEY_MEAL, DAILY_LIMIT_MEAL);
  if (!allowed) {
    return { items: [], message: 'Daily AI query limit reached (50/day). Try again tomorrow.', hasQuestions: false, isComplete: true };
  }

  try {
    const body: Record<string, unknown> = {
      text: description,
      healthProfile: healthProfile || '',
      todayContext: todayContext || '',
    };
    if (conversation && conversation.length > 0) {
      body.conversation = conversation;
    }

    const { data, error } = await supabase.functions.invoke('ai-meal-log', { body });

    if (error || !data) {
      const errMsg = error?.message || 'No data returned';
      return { items: [], message: `AI analysis failed: ${errMsg}`, hasQuestions: false, isComplete: true, error: errMsg };
    }

    return data as MealAnalysisResult;
  } catch (e: any) {
    return { items: [], message: `AI service error: ${e?.message || 'Unknown error'}`, hasQuestions: false, isComplete: true, error: e?.message };
  }
}

export interface PortfolioRecResponse {
  summary: string;
  recommendations: Array<{
    action: string;
    asset: string;
    reason: string;
    priority: string;
  }>;
  question?: string;
  disclaimer: string;
  error?: string;
}

export async function askPortfolioRecommend(
  holdings: PortfolioHolding[],
  goals: PortfolioGoal[],
  query?: string
): Promise<PortfolioRecResponse> {
  const allowed = await checkDailyLimit('meridian_ai_portfolio_calls', 50);
  if (!allowed) {
    return {
      summary: 'You\'ve reached the daily portfolio recommendation limit (50/day).',
      recommendations: [],
      disclaimer: 'For informational purposes only. This is not investment advice.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-portfolio-recommend', {
      body: { holdings, goals, query },
    });

    if (error || !data) {
      let body: Partial<PortfolioRecResponse> = {};
      if (error && typeof (error as any).context?.json === 'function') {
        try {
          body = await (error as any).context.json();
        } catch {
          body = {};
        }
      }
      return {
        summary: body.summary || 'Sorry, I couldn\'t analyze your portfolio. Please try again.',
        recommendations: body.recommendations || [],
        question: body.question,
        disclaimer: body.disclaimer || 'For informational purposes only. This is not investment advice.',
        error: error?.message,
      };
    }

    const result = data as PortfolioRecResponse;
    return {
      summary: result.summary || 'Analysis complete.',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      question: result.question,
      disclaimer: result.disclaimer || 'For informational purposes only. This is not investment advice.',
    };
  } catch (e: any) {
    return {
      summary: 'Sorry, the AI service is temporarily unavailable.',
      recommendations: [],
      disclaimer: 'For informational purposes only. This is not investment advice.',
      error: e?.message,
    };
  }
}
