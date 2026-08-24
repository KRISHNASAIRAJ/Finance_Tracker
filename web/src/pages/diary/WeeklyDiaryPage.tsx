import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Save, BookOpen } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useDiaryEntries, useUpsertDiaryEntry } from '../../hooks/data/usePersonal'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { istWeekNumber, istWeekYear } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(12, 0, 0, 0)
  const diff = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - diff)
  return copy
}

export function WeeklyDiaryPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: entries, isLoading } = useDiaryEntries(userId)
  const upsert = useUpsertDiaryEntry(userId)

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))

  const weekYear = istWeekYear(weekStart)
  const weekNumber = istWeekNumber(weekStart)

  const entry = useMemo(
    () => (entries ?? []).find((e) => e.week_year === weekYear && e.week_number === weekNumber),
    [entries, weekYear, weekNumber]
  )

  const shiftWeek = (dir: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(d)
  }

  const endOfWeek = new Date(weekStart)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  const rangeLabel = `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${endOfWeek.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="fade-up space-y-5">
      <PageHeader title="Weekly Diary" subtitle="Write a note for each week of the year" />

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#101010] p-3">
        <button onClick={() => shiftWeek(-1)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">Week {weekNumber} · {weekYear}</p>
          <p className="text-xs text-white/40">{rangeLabel}</p>
        </div>
        <button onClick={() => shiftWeek(1)} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <DiaryEditor
          key={`${weekYear}-${weekNumber}`}
          initialContent={entry?.content ?? ''}
          saving={upsert.isPending}
          onSave={async (content) => {
            await upsert.mutateAsync({ row: { week_year: weekYear, week_number: weekNumber, content }, id: entry?.id })
          }}
        />
      )}

      {(entries ?? []).length === 0 && !isLoading && (
        <EmptyState icon={BookOpen} title="No diary entries yet" subtitle="Start with this week" />
      )}
    </div>
  )
}

function DiaryEditor({ initialContent, onSave, saving }: { initialContent: string; onSave: (content: string) => Promise<void>; saving: boolean }) {
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    try {
      await onSave(content)
      setSaved(true)
      toast.success('Diary saved')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('Failed to save diary')
    }
  }

  return (
    <Card className="p-5">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What happened this week? Wins, learnings, highlights…"
        className="min-h-[280px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/30 focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10"
      />
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-[#59D6C7]">Saved</span>}
        <Button onClick={save} loading={saving} className="gap-1.5">
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>
    </Card>
  )
}