import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Plus, Sparkles, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useMealPlans,
  useUpsertMealPlan,
  useDeleteMealPlan,
  useRecipes,
  useMealLogs,
  useUpsertMealLog,
  type MealPlanRow,
} from '../../hooks/data/usePersonal'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { supabase } from '../../lib/supabase'
import { istDayKey } from '../../lib/habits'
import { toast } from '../../components/ui/Toast'

type Slot = MealPlanRow['slot']

const SLOTS: Array<{ key: Slot; label: string; emoji: string }> = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '🍱' },
  { key: 'snack', label: 'Snack', emoji: '🥤' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
]

function dayKeyOffset(offsetDays: number): string {
  return istDayKey(new Date(Date.now() + offsetDays * 86400000))
}

function prettyDay(dayKey: string): { weekday: string; date: string } {
  const d = new Date(`${dayKey}T12:00:00Z`)
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' }),
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  }
}

export function MealPlannerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: plans, isLoading } = useMealPlans(userId)
  const upsert = useUpsertMealPlan(userId)
  const remove = useDeleteMealPlan(userId)
  const { data: recipes } = useRecipes(userId)
  const { data: mealLogs } = useMealLogs(userId)
  const upsertMealLog = useUpsertMealLog(userId)

  const today = dayKeyOffset(0)
  const tomorrow = dayKeyOffset(1)
  const dayKeys = useMemo(() => Array.from({ length: 7 }, (_, i) => dayKeyOffset(i - 1)), [])

  const [pickerFor, setPickerFor] = useState<{ date: string; slot: Slot } | null>(null)
  const [query, setQuery] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const plansByDateSlot = useMemo(() => {
    const m = new Map<string, MealPlanRow>()
    for (const p of plans ?? []) m.set(`${p.plan_date}|${p.slot}`, p)
    return m
  }, [plans])

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipes ?? []
    return (recipes ?? []).filter((r) => r.title.toLowerCase().includes(q))
  }, [recipes, query])

  const pickRecipe = (recipeId: string, title: string) => {
    if (!pickerFor) return
    upsert.mutate({
      row: { plan_date: pickerFor.date, slot: pickerFor.slot, recipe_id: recipeId, title },
    })
    setPickerFor(null)
    setQuery('')
    setCustomTitle('')
  }

  const pickCustom = () => {
    if (!pickerFor || !customTitle.trim()) return
    upsert.mutate({
      row: { plan_date: pickerFor.date, slot: pickerFor.slot, recipe_id: null, title: customTitle.trim() },
    })
    setPickerFor(null)
    setQuery('')
    setCustomTitle('')
  }

  const clearSlot = (p: MealPlanRow) => {
    if (confirm(`Clear ${p.title} from this day?`)) remove.mutate(p.id)
  }

  const markEaten = (p: MealPlanRow) => {
    if (!p.done) {
      upsertMealLog.mutate({
        row: {
          date: new Date().toISOString(),
          meal_type: p.slot,
          items: [],
          notes: `Planned meal: ${p.title}${p.notes ? ` — ${p.notes}` : ''}`,
        },
      })
      toast.success('Logged to Meal Logger')
    }
    upsert.mutate({ row: { ...p, done: !p.done } })
  }

  /** Ask the meal AI to plan tomorrow's cooking (mirrors mobile). */
  const askAiTomorrow = async () => {
    if (aiLoading) return
    setAiLoading(true)
    try {
      const todayContext =
        (mealLogs ?? [])
          .filter((l) => (l.date ?? '').slice(0, 10) === today)
          .map((l) => `${l.meal_type}: ${typeof l.items === 'string' ? '' : (l.items ?? []).map((i: any) => i.name).join(', ') || l.notes || ''}`)
          .join('\n') || 'nothing logged yet today'
      const { data, error } = await supabase.functions.invoke('ai-meal-suggest', {
        body: {
          query:
            `Plan tomorrow's cooking (${prettyDay(tomorrow).date}). Give me exactly 4 lines, one per slot, in this format:\nBREAKFAST: <meal with kcal/protein>\nLUNCH: <meal with kcal/protein>\nSNACK: <meal with kcal/protein>\nDINNER: <meal with kcal/protein>\nAll home-cookable in my morning 5:30-7:45 AM cooking window.`,
          todayContext,
        },
      })
      if (error) throw error
      const suggestion = (data?.suggestion as string) || ''
      const lines = suggestion.split('\n').filter((l) => l.trim())
      let filled = 0
      for (const line of lines) {
        const m = line.match(/^\s*(BREAKFAST|LUNCH|SNACK|DINNER)\s*[:-]\s*(.+)$/i)
        if (!m) continue
        const slot = m[1].toLowerCase() as Slot
        const title = m[2].replace(/\*\*/g, '').trim()
        if (SLOTS.some((s) => s.key === slot)) {
          upsert.mutate({ row: { plan_date: tomorrow, slot, recipe_id: null, title } })
          filled++
        }
      }
      if (filled > 0) toast.success(`Planned ${filled} meals for tomorrow`)
      else toast.error('Could not parse the AI plan — try again')
    } catch {
      toast.error('AI plan failed — try again in a moment')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meal Planner"
        subtitle="Plan what to cook · 7 days · recipes or custom meals · AI for tomorrow"
        action={
          <Button size="sm" onClick={askAiTomorrow} disabled={aiLoading}>
            <Sparkles className={`h-4 w-4 ${aiLoading ? 'animate-pulse' : ''}`} />
            {aiLoading ? 'Planning…' : 'Plan tomorrow'}
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dayKeys.map((dk) => {
            const { weekday, date } = prettyDay(dk)
            const isToday = dk === today
            const isTomorrow = dk === tomorrow
            const planned = SLOTS.filter((s) => plansByDateSlot.get(`${dk}|${s.key}`)).length
            return (
              <Card
                key={dk}
                className={
                  isToday
                    ? 'border-[#9BA5FF]/45 bg-[#9BA5FF]/6'
                    : isTomorrow
                      ? 'border-[#4FDBCC]/35'
                      : ''
                }
              >
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-sm font-bold ${isToday ? 'text-[#9BA5FF]' : 'text-white'}`}>
                        {weekday}
                        {isToday && ' · TODAY'}
                        {isTomorrow && ' · TOMORROW'}
                      </p>
                      <p className="text-xs text-white/40">
                        {date} · {planned}/4 planned
                      </p>
                    </div>
                    <CalendarDays className="h-4 w-4 text-white/20" />
                  </div>
                  <div className="space-y-1">
                    {SLOTS.map((s) => {
                      const item = plansByDateSlot.get(`${dk}|${s.key}`)
                      return (
                        <div
                          key={s.key}
                          className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/3"
                        >
                          <span className="text-sm">{s.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/35">
                              {s.label}
                            </p>
                            {item ? (
                              <p
                                className={`truncate text-sm ${
                                  item.done ? 'text-white/35 line-through' : 'font-medium text-white/85'
                                }`}
                                title={item.notes || item.title}
                              >
                                {item.title}
                              </p>
                            ) : (
                              <button
                                onClick={() => setPickerFor({ date: dk, slot: s.key })}
                                className="text-xs text-white/25 hover:text-white/60"
                              >
                                + tap to plan
                              </button>
                            )}
                          </div>
                          {item && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => markEaten(item)}
                                title={item.done ? 'Unmark' : 'Mark cooked + log'}
                                className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                                  item.done
                                    ? 'border-[#4FDBCC] bg-[#4FDBCC] text-[#0A0A10]'
                                    : 'border-[#4FDBCC]/60 text-[#4FDBCC] hover:bg-[#4FDBCC]/10'
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => clearSlot(item)}
                                title="Clear slot"
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-white/40 opacity-0 transition-all hover:text-[#FF887D] group-hover:opacity-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Slot picker */}
      <Modal
        open={!!pickerFor}
        onClose={() => setPickerFor(null)}
        title={`${SLOTS.find((s) => s.key === pickerFor?.slot)?.label ?? ''} · ${pickerFor ? prettyDay(pickerFor.date).date : ''}`}
        wide
      >
        <div className="space-y-3">
          <Field.Input
            label="Search your recipes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. dosa, oats, paneer…"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {filteredRecipes.map((r) => (
              <button
                key={r.id}
                onClick={() => pickRecipe(r.id, r.title)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-left transition-colors hover:border-[#4FDBCC]/40 hover:bg-[#4FDBCC]/8"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white/90">{r.title}</p>
                  <p className="text-xs text-white/40">
                    {r.prep_time} · {r.calories}
                  </p>
                </div>
                <Plus className="h-4 w-4 shrink-0 text-[#4FDBCC]" />
              </button>
            ))}
            {filteredRecipes.length === 0 && (
              <p className="py-3 text-center text-sm text-white/40">
                {recipes && recipes.length > 0
                  ? 'No recipes match — type a custom meal below'
                  : 'No recipes yet — type a custom meal below'}
              </p>
            )}
          </div>
          <div className="flex items-end gap-2 border-t border-white/8 pt-3">
            <div className="flex-1">
              <Field.Input
                label="…or type a custom meal"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Ragi dosa + chutney"
              />
            </div>
            <Button size="sm" onClick={pickCustom} disabled={!customTitle.trim()}>
              Set
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
