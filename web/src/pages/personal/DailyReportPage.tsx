import { useCallback, useEffect, useState } from 'react'
import { Moon, Newspaper, RefreshCw, Sparkles, Sun } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui/Shared'
import { toast } from '../../components/ui/Toast'
import type { DailyReport } from '../../types'

function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}

function lastNDays(n: number): string[] {
  const out: string[] = []
  const base = Date.parse(istToday())
  for (let i = 0; i < n; i++) out.push(new Date(base - i * 86400000).toISOString().slice(0, 10))
  return out
}

export function DailyReportPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [selectedDate, setSelectedDate] = useState(istToday())
  const [mode, setMode] = useState<'evening' | 'morning'>('evening')

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_reports')
      .select('id, report_date, mode, content')
      .eq('user_id', userId)
      .gte('report_date', new Date(Date.parse(istToday()) - 3 * 86400000).toISOString().slice(0, 10))
      .order('report_date', { ascending: false })
    if (!error) {
      setReports(
        (data ?? []).map((r: any) => ({
          id: r.id as string,
          reportDate: r.report_date as string,
          mode: (r.mode as 'evening' | 'morning') ?? 'evening',
          content: r.content ?? { headline: '', summary: '', sections: [], disclaimer: '' },
        }))
      )
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const dateReports = reports.filter((r) => r.reportDate === selectedDate)
  const active = dateReports.find((r) => r.mode === mode) ?? dateReports[0] ?? null
  const activeMode = active?.mode ?? mode

  const handleGenerate = async () => {
    if (generating || !userId) return
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-daily-report', {
        body: { mode, user_id: userId },
      })
      if (error) throw error
      const results = (data as any) ?? {}
      const mine = Array.isArray(results.results) ? results.results[0] : undefined
      if (mine?.skipped) {
        toast.info('Report already generated for today')
      } else if (mine?.error) {
        const detail = typeof mine.detail === 'string' ? ` (${mine.detail})` : ''
        toast.error(`Report failed: ${mine.error}${detail}`)
      } else if (results.ok === false) {
        toast.error('Report failed on the server. Try again in a minute.')
      } else {
        toast.success('Report generated')
      }
      await load()
    } catch (e: any) {
      toast.error(e?.message ? `Network error: ${e.message}` : 'Network error — check your connection.')
    } finally {
      setGenerating(false)
    }
  }

  const dateChipLabel = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  const renderBody = (body: string) =>
    body.split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) =>
      line.startsWith('- ') ? (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9BA5FF]" />
          <p className="text-sm text-white/75">{line.slice(2)}</p>
        </div>
      ) : (
        <p key={i} className="text-sm text-white/75">{line}</p>
      )
    )

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Daily Report"
        subtitle="Evening summary at 9:30 PM · Morning briefing at 8:30 AM (IST)"
        action={
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={handleGenerate} loading={generating}>
            <RefreshCw className="h-4 w-4" /> Generate now
          </Button>
        }
      />

      {/* Date strip */}
      <div className="flex gap-2">
        {lastNDays(4).map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              d === selectedDate ? 'bg-[#9BA5FF] text-black' : 'border border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            {d === istToday() ? 'Today' : dateChipLabel(d)}
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['evening', 'morning'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              activeMode === m ? 'bg-[#9BA5FF]/15 text-[#9BA5FF]' : 'border border-white/10 text-white/50 hover:bg-white/5'
            }`}
          >
            {m === 'evening' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {m === 'evening' ? 'Evening 9:30 PM' : 'Morning 8:30 AM'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : active && active.content?.headline ? (
        <div className="space-y-4">
          <Card className="p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#9BA5FF]">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h2 className="mt-2 text-xl font-extrabold text-white">{active.content.headline}</h2>
            <p className="mt-2 text-sm text-white/60">{active.content.summary}</p>
          </Card>

          {active.content.sections?.map((sec, i) => (
            <Card key={i} className="p-5">
              <p className="text-xs font-bold tracking-wider text-[#9BA5FF]">{sec.title}</p>
              <div className={`mt-2.5 space-y-1.5 ${sec.title === 'QUOTE' ? 'border-l-2 border-[#9BA5FF] pl-4' : ''}`}>
                {renderBody(sec.body)}
              </div>
            </Card>
          ))}

          {active.content.disclaimer && (
            <p className="text-center text-[11px] italic text-white/30">{active.content.disclaimer}</p>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Newspaper}
          title={`No ${activeMode} report for ${dateChipLabel(selectedDate)}`}
          subtitle="Reports arrive automatically — or generate one now."
          action={
            <Button size="sm" className="gap-1.5" onClick={handleGenerate} loading={generating}>
              <Sparkles className="h-4 w-4" /> Generate now
            </Button>
          }
        />
      )}
    </div>
  )
}
