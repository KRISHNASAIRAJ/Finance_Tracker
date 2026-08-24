/**
 * useAI — Groq-backed edge function calls (same functions as mobile).
 * All AI calls go through Supabase edge functions; never direct to Groq.
 */
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useAskCardTnC() {
  return useMutation({
    mutationFn: async ({ cardId, question }: { cardId: string; question: string }) => {
      const { data, error } = await supabase.functions.invoke('ai-tnc-query', {
        body: { cardId, question },
      })
      if (error) throw error
      return data as { answer?: string; disclaimer?: string }
    },
  })
}

export function usePortfolioRecommend() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-portfolio-recommend', {
        body: {},
      })
      if (error) throw error
      return data as { recommendation?: string; disclaimer?: string }
    },
  })
}

export function useAnalyzeMealText() {
  return useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const { data, error } = await supabase.functions.invoke('ai-meal-log', {
        body: { text },
      })
      if (error) throw error
      return data as {
        items?: Array<{ name: string; quantity: string; calories: number; protein: number; carbs: number; fat: number }>
        note?: string
        disclaimer?: string
      }
    },
  })
}

export function useMealSuggest() {
  return useMutation({
    mutationFn: async ({ mealType, preferences }: { mealType: string; preferences?: string }) => {
      const { data, error } = await supabase.functions.invoke('ai-meal-suggest', {
        body: { mealType, preferences },
      })
      if (error) throw error
      return data as { suggestion?: string; disclaimer?: string }
    },
  })
}

export function useDailyReport() {
  return useMutation({
    mutationFn: async ({ todayIntake }: { todayIntake: unknown }) => {
      const { data, error } = await supabase.functions.invoke('ai-daily-report', {
        body: { todayIntake },
      })
      if (error) throw error
      return data as { report?: string; disclaimer?: string }
    },
  })
}