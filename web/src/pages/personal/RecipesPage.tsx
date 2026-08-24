import { useState } from 'react'
import { Plus, Pencil, Trash2, ChefHat } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useRecipes, useUpsertRecipe, useDeleteRecipe } from '../../hooks/data/usePersonal'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'
import type { Recipe } from '../../types'

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p.map(String) : []
  } catch {
    return []
  }
}

export function RecipesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: recipes, isLoading } = useRecipes(userId)
  const upsert = useUpsertRecipe(userId)
  const del = useDeleteRecipe(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [calories, setCalories] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setTitle('')
    setPrepTime('')
    setCalories('')
    setIngredientsText('')
    setStepsText('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const r = (recipes ?? []).find((x) => x.id === id)
    if (!r) return
    setEditing(id)
    setTitle(r.title)
    setPrepTime(r.prep_time != null ? String(r.prep_time) : '')
    setCalories(r.calories != null ? String(r.calories) : '')
    setIngredientsText(parseList(r.ingredients).join('\n'))
    setStepsText(parseList(r.steps).join('\n'))
    setModalOpen(true)
  }

  const save = async () => {
    if (!title.trim()) { toast.error('Recipe title required'); return }
    setSaving(true)
    try {
      const row: Partial<Recipe> = {
        title: title.trim(),
        prep_time: prepTime ? Number(prepTime) || null : null,
        calories: calories ? Number(calories) || null : null,
        ingredients: JSON.stringify(ingredientsText.split('\n').map((s) => s.trim()).filter(Boolean)),
        steps: JSON.stringify(stepsText.split('\n').map((s) => s.trim()).filter(Boolean)),
      }
      await upsert.mutateAsync({ row, id: editing ?? undefined })
      toast.success(editing ? 'Recipe updated' : 'Recipe added')
      setModalOpen(false)
    } catch { toast.error('Failed to save recipe') } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleting) return
    try { await del.mutateAsync(deleting); toast.success('Recipe deleted') }
    catch { toast.error('Failed to delete recipe') }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Recipes"
        subtitle={`${recipes?.length ?? 0} recipes`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add recipe
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : (recipes ?? []).length === 0 ? (
        <EmptyState icon={ChefHat} title="No recipes" subtitle="Save your favourite recipes" action={<Button variant="secondary" size="sm" onClick={openNew}>Add recipe</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(recipes ?? []).map((r) => {
            const ingredients = parseList(r.ingredients)
            const steps = parseList(r.steps)
            return (
              <Card key={r.id} className="group p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{r.title}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {r.prep_time != null && `${r.prep_time} min`}
                      {r.prep_time != null && r.calories != null && ' · '}
                      {r.calories != null && `${r.calories} kcal`}
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(r.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(r.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {ingredients.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ingredients.slice(0, 6).map((ing, i) => (
                      <span key={i} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-white/60">{ing}</span>
                    ))}
                    {ingredients.length > 6 && (
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-white/35">+{ingredients.length - 6}</span>
                    )}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-white/35">{steps.length} steps</p>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit recipe' : 'Add recipe'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dal Tadka" />
          <div className="grid grid-cols-2 gap-4">
            <Field.Input label="Prep time (min)" type="number" min="0" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="30" />
            <Field.Input label="Calories (kcal)" type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="450" />
          </div>
          <Field.Textarea label="Ingredients (one per line)" value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} placeholder={'1 cup dal\n2 tbsp oil\n...'} />
          <Field.Textarea label="Steps (one per line)" value={stepsText} onChange={(e) => setStepsText(e.target.value)} placeholder={'Wash and soak dal\nPressure cook for 3 whistles\n...'} />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete recipe" message="This recipe will be permanently removed." loading={del.isPending} />
    </div>
  )
}