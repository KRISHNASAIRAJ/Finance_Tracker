import { Calendar, Flag, Target } from 'lucide-react'
import { PageHeader } from '../../components/ui/Shared'
import { Card, CardBody } from '../../components/ui/Card'
import { CAREER_GOALS, currentYearGoals } from '../../lib/careerGoals'

export function CareerGoalsPage() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const active = currentYearGoals(now)

  return (
    <div className="space-y-6">
      <PageHeader title="Career Goals" subtitle="2025 → 2031 roadmap · the mission is personal" />

      {active && (
        <Card className="border-[#9BA5FF]/30 bg-gradient-to-br from-[#9BA5FF]/10 to-transparent">
          <CardBody className="space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9BA5FF]">
              <Target className="h-3.5 w-3.5" /> Focus year
            </p>
            <p className="text-xl font-bold text-white">
              {active.emoji} {active.year} · {active.title}
            </p>
            <p className="text-sm text-white/45">
              {active.items.length} goals this year — take your goal as a personal mission.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="space-y-4">
        {CAREER_GOALS.map((g) => {
          const isPast = g.year < currentYear
          const isActive = g.year === currentYear
          return (
            <Card
              key={g.year}
              className={
                isActive
                  ? 'border-[#9BA5FF]/45 bg-[#9BA5FF]/6'
                  : isPast
                    ? 'opacity-80'
                    : ''
              }
            >
              <CardBody className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 items-center rounded-xl border border-white/12 bg-white/6 px-4 text-sm font-extrabold text-white/80">
                    {g.year}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-base font-bold text-white">
                      <Flag className={`h-4 w-4 ${isActive ? 'text-[#9BA5FF]' : 'text-white/30'}`} />
                      {g.emoji} {g.title}
                    </p>
                    {isActive && (
                      <p className="mt-0.5 text-[10px] font-extrabold tracking-[0.2em] text-[#9BA5FF]">
                        THIS YEAR
                      </p>
                    )}
                    {isPast && (
                      <p className="mt-0.5 text-[11px] text-[#4FDBCC]/70">Foundation laid 🌱</p>
                    )}
                  </div>
                </div>
                <ul className="space-y-2">
                  {g.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          isPast ? 'bg-[#4FDBCC]/70' : 'bg-white/20'
                        }`}
                      />
                      <span className={`text-sm leading-relaxed ${isPast ? 'text-white/45' : 'text-white/85'}`}>
                        {it}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <p className="flex items-center justify-center gap-2 pb-4 text-center text-xs text-white/25">
        <Calendar className="h-3.5 w-3.5" />
        Sacrifice is the key to success for your goals.
      </p>
    </div>
  )
}
