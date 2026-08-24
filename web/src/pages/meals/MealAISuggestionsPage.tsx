import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMealSuggest } from '../../hooks/useAI'
import { PageHeader } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'
import type { MealType } from '../../types'

const SLOTS: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
]

export function MealAISuggestionsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const suggest = useMealSuggest()

  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [preferences, setPreferences] = useState('')

  const getSuggestion = async () => {
    if (!userId) return
    try {
      await suggest.mutateAsync({ mealType, preferences: preferences.trim() || undefined })
    } catch {
      toast.error('Failed to get suggestion')
    }
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="AI Meal Suggestions"
        subtitle="Personalised meal ideas from the AI"
        action={
          <span className="flex items-center gap-1.5 rounded-full bg-[#9BA5FF]/15 px-3 py-1.5 text-xs font-medium text-[#9BA5FF]">
            <Sparkles className="h-3.5 w-3.5" /> AI powered
          </span>
        }
      />

      <Card>
        <CardBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field.Select label="Meal type" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} options={SLOTS} />
              <Field.Input label="Preferences" value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="e.g. vegetarian, high protein, under 500 kcal" />
            </div>
            <Button onClick={getSuggestion} loading={suggest.isPending} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Get suggestion
            </Button>
          </div>
        </CardBody>
      </Card>

      {suggest.data?.suggestion && (
        <Card>
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-white/80">{suggest.data.suggestion}</p>
            {suggest.data.disclaimer && (
              <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/30">{suggest.data.disclaimer}</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}