import { useMemo, useState } from 'react'
import { Salad, Save } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useDietPlans, useUpdateDietPlan } from '../../hooks/data/usePersonal'
import { PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { toast } from '../../components/ui/Toast'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
] as const

export function DietViewerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: plans, isLoading } = useDietPlans(userId)
  const updateDiet = useUpdateDietPlan(userId)

  const [savingDay, setSavingDay] = useState<string | null>(null)

  const planMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {}
    for (const p of plans ?? []) {
      map[p.day] = map[p.day] ?? {}
      map[p.day][p.meal_type] = p.meal_name
    }
    return map
  }, [plans])

  const saveDay = async (day: string, slots: Record<string, string>) => {
    setSavingDay(day)
    try {
      for (const mealType of SLOTS.map((s) => s.key)) {
        const mealName = (slots[mealType] ?? '').trim()
        if (mealName) await updateDiet.mutateAsync({ day, mealType, mealName })
      }
      toast.success(`${day} diet saved`)
    } catch {
      toast.error('Failed to save diet plan')
    } finally {
      setSavingDay(null)
    }
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader title="Diet Viewer" subtitle="Weekly meal plan" />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((day) => (
            <DayRow
              key={day}
              day={day}
              initial={planMap[day] ?? {}}
              saving={savingDay === day}
              onSave={saveDay}
            />
          ))}
          <p className="flex items-center gap-1.5 px-1 text-xs text-white/30">
            <Salad className="h-3.5 w-3.5" /> Type a meal for each slot and hit Save on the day row.
          </p>
        </div>
      )}
    </div>
  )
}

function DayRow({
  day,
  initial,
  saving,
  onSave,
}: {
  day: string
  initial: Record<string, string>
  saving: boolean
  onSave: (day: string, slots: Record<string, string>) => Promise<void>
}) {
  const [slots, setSlots] = useState<Record<string, string>>(initial)

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{day}</p>
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => onSave(day, slots)} loading={saving}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="space-y-1.5">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-white/40">{slot.label}</label>
            <input
              value={slots[slot.key] ?? ''}
              onChange={(e) => setSlots((v) => ({ ...v, [slot.key]: e.target.value }))}
              placeholder={`${slot.label} plan`}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-white/30 focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10"
            />
          </div>
        ))}
      </div>
    </Card>
  )
}