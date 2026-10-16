import { useMemo, useState } from 'react'
import { Flag, Pencil, Plus, RotateCcw, Target } from 'lucide-react'
import { PageHeader } from '../../components/ui/Shared'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useSettingsContent, useSaveSettingsContent } from '../../hooks/data/usePersonal'
import {
  effectiveGoals,
  currentYearGoalsFrom,
  parseCareerGoals,
  type CareerGoalYear,
} from '../../lib/careerGoals'

export function CareerGoalsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: settings } = useSettingsContent(userId)
  const saveSettings = useSaveSettingsContent(userId)

  const now = new Date()
  const currentYear = now.getFullYear()

  const goals = useMemo(
    () => effectiveGoals(parseCareerGoals(settings?.career_goals_json)),
    [settings?.career_goals_json],
  )
  const active = currentYearGoalsFrom(goals, now)
  const hasOverrides = goals.length > 0 && parseCareerGoals(settings?.career_goals_json) !== null

  // Edit modal state
  const [itemEdit, setItemEdit] = useState<{ year: number; index: number; text: string } | null>(null)
  const [yearEdit, setYearEdit] = useState<{ year: number; title: string; emoji: string } | null>(null)
  const [adding, setAdding] = useState<{ year: number; text: string } | null>(null)

  const persist = (next: CareerGoalYear[]) => {
    saveSettings.mutate({ careerGoalsJson: JSON.stringify(next) })
  }

  const saveItemEdit = () => {
    if (!itemEdit || !itemEdit.text.trim()) return
    persist(
      goals.map((g) =>
        g.year === itemEdit.year
          ? { ...g, items: g.items.map((it, i) => (i === itemEdit.index ? itemEdit.text.trim() : it)) }
          : g,
      ),
    )
    setItemEdit(null)
  }

  const deleteItem = () => {
    if (!itemEdit) return
    persist(
      goals.map((g) =>
        g.year === itemEdit.year
          ? { ...g, items: g.items.filter((_, i) => i !== itemEdit.index) }
          : g,
      ),
    )
    setItemEdit(null)
  }

  const saveYearEdit = () => {
    if (!yearEdit || !yearEdit.title.trim()) return
    persist(
      goals.map((g) =>
        g.year === yearEdit.year
          ? { ...g, title: yearEdit.title.trim(), emoji: yearEdit.emoji.trim() || g.emoji }
          : g,
      ),
    )
    setYearEdit(null)
  }

  const addGoal = () => {
    if (!adding || !adding.text.trim()) return
    persist(
      goals.map((g) =>
        g.year === adding.year ? { ...g, items: [...g.items, adding.text.trim()] } : g,
      ),
    )
    setAdding(null)
  }

  const resetGoals = () => {
    if (confirm('Reset to the original roadmap? All your edits will be removed.')) {
      saveSettings.mutate({ careerGoalsJson: null })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career Goals"
        subtitle="2025 → 2031 roadmap · long-press (right-click) a goal to edit"
        action={
          hasOverrides ? (
            <Button variant="ghost" size="sm" onClick={resetGoals} aria-label="Reset roadmap">
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

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
        {goals.map((g) => {
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
                <div
                  className="group flex cursor-pointer items-center gap-4"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setYearEdit({ year: g.year, title: g.title, emoji: g.emoji })
                  }}
                  onDoubleClick={() => setYearEdit({ year: g.year, title: g.title, emoji: g.emoji })}
                  title="Long-press (right-click) to rename this year"
                >
                  <span className="flex h-14 items-center rounded-xl border border-white/12 bg-white/6 px-4 text-sm font-extrabold text-white/80">
                    {g.year}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-base font-bold text-white">
                      <Flag className={`h-4 w-4 ${isActive ? 'text-[#9BA5FF]' : 'text-white/30'}`} />
                      {g.emoji} {g.title}
                      <Pencil className="h-3 w-3 text-white/0 transition-colors group-hover:text-white/30" />
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
                  {g.items.map((it, i) => (
                    <li
                      key={`${g.year}-${i}`}
                      className="group flex cursor-pointer items-start gap-2.5"
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setItemEdit({ year: g.year, index: i, text: it })
                      }}
                      onDoubleClick={() => setItemEdit({ year: g.year, index: i, text: it })}
                      title="Long-press (right-click) to edit"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          isPast ? 'bg-[#4FDBCC]/70' : 'bg-white/20'
                        }`}
                      />
                      <span className={`flex-1 text-sm leading-relaxed ${isPast ? 'text-white/45' : 'text-white/85'}`}>
                        {it}
                      </span>
                      <Pencil className="mt-1 h-3 w-3 shrink-0 text-white/0 transition-colors group-hover:text-white/30" />
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() => setAdding({ year: g.year, text: '' })}
                      className="flex items-center gap-1.5 pl-[18px] text-xs font-semibold text-[#9BA5FF]/80 hover:text-[#9BA5FF]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add goal for {g.year}
                    </button>
                  </li>
                </ul>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* Edit goal item */}
      <Modal
        open={!!itemEdit}
        onClose={() => setItemEdit(null)}
        title="Edit goal"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={deleteItem}>
              Delete
            </Button>
            <Button size="sm" onClick={saveItemEdit}>
              Save
            </Button>
          </>
        }
      >
        <Field.Input
          label="Goal"
          value={itemEdit?.text ?? ''}
          onChange={(e) =>
            setItemEdit((prev) => (prev ? { ...prev, text: e.target.value } : prev))
          }
          autoFocus
        />
      </Modal>

      {/* Edit year meta */}
      <Modal
        open={!!yearEdit}
        onClose={() => setYearEdit(null)}
        title={`Edit ${yearEdit?.year ?? ''}`}
        footer={
          <Button size="sm" onClick={saveYearEdit}>
            Save
          </Button>
        }
      >
        <div className="flex gap-3">
          <Field.Input
            label="Emoji"
            value={yearEdit?.emoji ?? ''}
            onChange={(e) =>
              setYearEdit((prev) => (prev ? { ...prev, emoji: e.target.value } : prev))
            }
            maxLength={4}
            className="w-20 text-center"
          />
          <Field.Input
            label="Year title"
            value={yearEdit?.title ?? ''}
            onChange={(e) =>
              setYearEdit((prev) => (prev ? { ...prev, title: e.target.value } : prev))
            }
            autoFocus
          />
        </div>
      </Modal>

      {/* Add goal */}
      <Modal
        open={!!adding}
        onClose={() => setAdding(null)}
        title={`Add goal for ${adding?.year ?? ''}`}
        footer={
          <Button size="sm" onClick={addGoal} disabled={!adding?.text.trim()}>
            Add
          </Button>
        }
      >
        <Field.Input
          label="Goal"
          value={adding?.text ?? ''}
          onChange={(e) => setAdding((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
          placeholder="e.g. Net worth ₹3 lakh"
          autoFocus
        />
      </Modal>
    </div>
  )
}
