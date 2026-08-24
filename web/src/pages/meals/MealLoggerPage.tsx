import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, ChevronLeft, ChevronRight, Sparkles, BarChart3, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMealLogs, useUpsertMealLog, useDeleteMealLog } from '../../hooks/data/usePersonal'
import { useAnalyzeMealText, useDailyReport } from '../../hooks/useAI'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { istDateString } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { MealFoodItem, MealLogEntry, MealType } from '../../types'

const TARGET_KEYS = ['calories', 'protein', 'carbs', 'fat'] as const
type TargetKey = (typeof TARGET_KEYS)[number]
const DEFAULT_TARGETS: Record<TargetKey, number> = { calories: 2650, protein: 130, carbs: 340, fat: 85 }
const SLOTS: Array<{ key: MealType; label: string }> = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Snack' },
  { key: 'dinner', label: 'Dinner' },
]

function parseItems(items: unknown): MealFoodItem[] {
  if (!items) return []
  if (Array.isArray(items)) return items as MealFoodItem[]
  try {
    const p = JSON.parse(String(items))
    return Array.isArray(p) ? (p as MealFoodItem[]) : []
  } catch {
    return []
  }
}

function sumMacros(items: MealFoodItem[]) {
  return items.reduce(
    (s, i) => ({
      calories: s.calories + (Number(i.calories) || 0),
      protein: s.protein + (Number(i.protein) || 0),
      carbs: s.carbs + (Number(i.carbs) || 0),
      fat: s.fat + (Number(i.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

const EMPTY_ITEM = { name: '', quantity: '', calories: '', protein: '', carbs: '', fat: '' }

export function MealLoggerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: logs, isLoading } = useMealLogs(userId)
  const upsert = useUpsertMealLog(userId)
  const del = useDeleteMealLog(userId)
  const analyze = useAnalyzeMealText()
  const report = useDailyReport()

  const [selectedDate, setSelectedDate] = useState(() => istDateString())
  const [targets, setTargets] = useState<Record<TargetKey, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('meridian.macroTargets') ?? '') as Partial<Record<TargetKey, number>>
      return { ...DEFAULT_TARGETS, ...saved }
    } catch {
      return DEFAULT_TARGETS
    }
  })

  useEffect(() => {
    localStorage.setItem('meridian.macroTargets', JSON.stringify(targets))
  }, [targets])

  const [addOpen, setAddOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const [addSlot, setAddSlot] = useState<MealType>('breakfast')
  const [addNotes, setAddNotes] = useState('')
  const [item, setItem] = useState(EMPTY_ITEM)
  const [items, setItems] = useState<MealFoodItem[]>([])

  const [aiSlot, setAiSlot] = useState<MealType>('breakfast')
  const [aiText, setAiText] = useState('')
  const [aiItems, setAiItems] = useState<MealFoodItem[] | null>(null)

  const [saving, setSaving] = useState(false)

  const dayLogs = useMemo(
    () => (logs ?? []).filter((l) => l.date.slice(0, 10) === selectedDate),
    [logs, selectedDate]
  )

  const dayTotals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 }
    for (const l of dayLogs) {
      const s = sumMacros(parseItems(l.items))
      t.calories += s.calories
      t.protein += s.protein
      t.carbs += s.carbs
      t.fat += s.fat
      t.items += parseItems(l.items).length
    }
    return t
  }, [dayLogs])

  const shiftDate = (dir: number) => {
    const d = new Date(`${selectedDate}T12:00:00`)
    d.setDate(d.getDate() + dir)
    setSelectedDate(d.toLocaleDateString('en-CA'))
  }

  const addItemToList = () => {
    if (!item.name.trim()) { toast.error('Item name required'); return }
    setItems((prev) => [
      ...prev,
      {
        name: item.name.trim(),
        quantity: item.quantity.trim(),
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fat) || 0,
      },
    ])
    setItem(EMPTY_ITEM)
  }

  const saveMeal = async (mealType: MealType, mealItems: MealFoodItem[], notes: string | null) => {
    if (mealItems.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      const row: Partial<MealLogEntry> = { date: selectedDate, meal_type: mealType, items: mealItems, notes }
      await upsert.mutateAsync({ row })
      toast.success('Meal logged')
      setAddOpen(false)
      setItems([])
      setAddNotes('')
    } catch {
      toast.error('Failed to save meal')
    } finally {
      setSaving(false)
    }
  }

  const submitAI = async () => {
    if (!aiText.trim()) return
    try {
      const res = await analyze.mutateAsync({ text: aiText.trim() })
      setAiItems(res.items ?? [])
      if ((res.items ?? []).length === 0) toast.info('No items parsed — try describing the meal in more detail')
    } catch {
      toast.error('AI analysis failed')
    }
  }

  const addAIItems = () => {
    if (!aiItems || aiItems.length === 0) return
    saveMeal(aiSlot, aiItems, 'AI parsed')
    setAiOpen(false)
    setAiItems(null)
    setAiText('')
  }

  const runReport = async () => {
    setReportOpen(true)
    try {
      await report.mutateAsync({
        todayIntake: {
          date: selectedDate,
          calories: dayTotals.calories,
          protein: dayTotals.protein,
          carbs: dayTotals.carbs,
          fat: dayTotals.fat,
          mealCount: dayLogs.length,
          targets,
        },
      })
    } catch {
      toast.error('Failed to generate report')
    }
  }

  const doDelete = async (id: string) => {
    try { await del.mutateAsync(id); toast.success('Entry deleted') }
    catch { toast.error('Failed to delete entry') }
  }

  const targetFields: Array<{ key: keyof typeof DEFAULT_TARGETS; label: string }> = [
    { key: 'calories', label: 'Calories' },
    { key: 'protein', label: 'Protein (g)' },
    { key: 'carbs', label: 'Carbs (g)' },
    { key: 'fat', label: 'Fat (g)' },
  ]

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Meal Logger"
        subtitle="Daily food & macro log"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => { setAiOpen(true); setAiItems(null); setAiText('') }}>
              <Sparkles className="h-4 w-4" /> AI analyze
            </Button>
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={runReport}>
              <BarChart3 className="h-4 w-4" /> Daily report
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setAddOpen(true); setItems([]); setAddNotes('') }}>
              <Plus className="h-4 w-4" /> Add meal
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#101010] p-3">
        <button onClick={() => shiftDate(-1)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-white">
          {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <button onClick={() => shiftDate(1)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <Card>
        <CardHeader title="Macro targets" subtitle={`${dayLogs.length} meals · ${dayTotals.items} items today`} />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {targetFields.map(({ key, label }) => {
              const done = dayTotals[key]
              const target = targets[key]
              const over = done > target
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-white/50">{label}</span>
                    <span className={`text-sm font-bold tnum ${over ? 'text-[#FF887D]' : 'text-[#59D6C7]'}`}>{Math.round(done)}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={target}
                    onChange={(e) => setTargets((t) => ({ ...t, [key]: Number(e.target.value) || 0 }))}
                    className="mt-1.5 h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white tnum focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10"
                  />
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${over ? 'bg-[#FF887D]' : 'bg-[#59D6C7]'}`}
                      style={{ width: `${Math.min(100, (done / (target || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : dayLogs.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No meals logged" subtitle={`Nothing logged for ${selectedDate}`} action={<Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>Add meal</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SLOTS.map(({ key, label }) => {
            const entries = dayLogs.filter((l) => l.meal_type === key)
            const slotTotal = sumMacros(entries.flatMap((l) => parseItems(l.items)))
            return (
              <Card key={key}>
                <CardHeader
                  title={label}
                  subtitle={`${slotTotal.calories.toFixed(0)} kcal`}
                  action={<span className="text-xs text-white/35 tnum">P {slotTotal.protein.toFixed(0)} · C {slotTotal.carbs.toFixed(0)} · F {slotTotal.fat.toFixed(0)}</span>}
                />
                <CardBody>
                  {entries.length === 0 ? (
                    <p className="py-3 text-center text-xs text-white/30">No {label.toLowerCase()} logged</p>
                  ) : (
                    <div className="space-y-2">
                      {entries.map((l) => {
                        const parsed = parseItems(l.items)
                        return (
                          <div key={l.id} className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-white/85">{parsed.map((i) => i.name).join(', ')}</p>
                              {l.notes && <p className="mt-0.5 text-[11px] text-white/40">{l.notes}</p>}
                            </div>
                            <button onClick={() => doDelete(l.id)} className="shrink-0 rounded-lg p-1.5 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-[#FF887D]">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add meal"
        subtitle={`Logging for ${selectedDate}`}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMeal(addSlot, items, addNotes.trim() || null)} loading={saving || upsert.isPending}>{items.length > 0 ? `Save ${items.length} item${items.length > 1 ? 's' : ''}` : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field.Select label="Meal slot" value={addSlot} onChange={(e) => setAddSlot(e.target.value as MealType)} options={SLOTS.map((s) => ({ value: s.key, label: s.label }))} />
            <Field.Input label="Notes" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <div className="rounded-xl border border-white/10 p-4">
            <p className="mb-3 text-xs font-medium text-white/60">Item</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field.Input label="Name" value={item.name} onChange={(e) => setItem((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Chicken biryani" className="sm:col-span-2" />
              <Field.Input label="Quantity" value={item.quantity} onChange={(e) => setItem((s) => ({ ...s, quantity: e.target.value }))} placeholder="1 plate" />
              <Field.Input label="Calories" type="number" value={item.calories} onChange={(e) => setItem((s) => ({ ...s, calories: e.target.value }))} placeholder="450" />
              <Field.Input label="Protein (g)" type="number" value={item.protein} onChange={(e) => setItem((s) => ({ ...s, protein: e.target.value }))} placeholder="25" />
              <Field.Input label="Carbs (g)" type="number" value={item.carbs} onChange={(e) => setItem((s) => ({ ...s, carbs: e.target.value }))} placeholder="50" />
              <Field.Input label="Fat (g)" type="number" value={item.fat} onChange={(e) => setItem((s) => ({ ...s, fat: e.target.value }))} placeholder="12" />
            </div>
            <Button size="sm" variant="secondary" className="mt-3 gap-1.5" onClick={addItemToList}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
            {items.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-white/60">Items ({items.length})</p>
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs">
                    <span className="flex-1 text-white/80">{it.name}{it.quantity ? ` (${it.quantity})` : ''}</span>
                    <span className="text-white/40 tnum">{it.calories} kcal</span>
                    <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="rounded p-1 text-white/30 hover:text-[#FF887D]">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={aiOpen}
        onClose={() => { setAiOpen(false); setAiItems(null) }}
        title="AI meal analyzer"
        subtitle="Paste what you ate — the AI extracts items & macros"
        wide
        footer={
          aiItems && aiItems.length > 0 ? (
            <>
              <Button variant="secondary" onClick={() => { setAiItems(null); setAiText('') }}>Re-analyze</Button>
              <Button onClick={addAIItems} loading={upsert.isPending}>
                <Plus className="h-4 w-4" /> Add to log
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setAiOpen(false)}>Close</Button>
              <Button onClick={submitAI} loading={analyze.isPending}>Analyze</Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          <Field.Select label="Meal slot" value={aiSlot} onChange={(e) => setAiSlot(e.target.value as MealType)} options={SLOTS.map((s) => ({ value: s.key, label: s.label }))} />
          <Field.Textarea label="Meal description" value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="e.g. I ate a chicken sandwich with 2 slices of brown bread, cheese, mayo and a coke" />
          {aiItems && aiItems.length > 0 && (
            <div className="space-y-2 rounded-xl border border-white/10 p-4">
              <p className="text-xs font-medium text-white/60">Parsed items ({aiItems.length})</p>
              {aiItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs">
                  <span className="flex-1 text-white/80">{it.name}{it.quantity ? ` (${it.quantity})` : ''}</span>
                  <span className="text-white/40 tnum">{it.calories} kcal · P{it.protein} C{it.carbs} F{it.fat}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Daily report"
        subtitle={selectedDate}
        footer={<Button variant="secondary" onClick={() => setReportOpen(false)}>Close</Button>}
      >
        {report.isPending ? (
          <p className="py-6 text-center text-sm text-white/40">Generating report…</p>
        ) : report.data?.report ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-white/80">{report.data.report}</p>
            {report.data.disclaimer && <p className="text-[11px] text-white/30">{report.data.disclaimer}</p>}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-white/40">No report yet</p>
        )}
      </Modal>
    </div>
  )
}