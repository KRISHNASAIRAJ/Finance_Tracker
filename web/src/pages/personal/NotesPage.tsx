import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNotes, useUpsertNote, useDeleteNote } from '../../hooks/data/usePersonal'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import { formatDate } from '../../lib/format'
import { toast } from '../../components/ui/Toast'

export function NotesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: notes, isLoading } = useNotes(userId)
  const upsert = useUpsertNote(userId)
  const del = useDeleteNote(userId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setTitle('')
    setContent('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const n = (notes ?? []).find((x) => x.id === id)
    if (!n) return
    setEditing(id)
    setTitle(n.title)
    setContent(n.content ?? '')
    setModalOpen(true)
  }

  const save = async () => {
    if (!title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    try {
      await upsert.mutateAsync({ row: { title: title.trim(), content: content.trim() || null }, id: editing ?? undefined })
      toast.success(editing ? 'Note updated' : 'Note added')
      setModalOpen(false)
    } catch { toast.error('Failed to save note') } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleting) return
    try { await del.mutateAsync(deleting); toast.success('Note deleted') }
    catch { toast.error('Failed to delete note') }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Personal Notes"
        subtitle={`${notes?.length ?? 0} notes`}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add note
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (notes ?? []).length === 0 ? (
        <EmptyState icon={Plus} title="No notes" subtitle="Start writing your thoughts" action={<Button variant="secondary" size="sm" onClick={openNew}>Add note</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(notes ?? []).map((n) => (
            <Card key={n.id} className="group p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{n.title}</p>
                  {n.content && <p className="mt-1.5 line-clamp-3 text-xs text-white/50">{n.content}</p>}
                  <p className="mt-2 text-[11px] text-white/30">{formatDate(n.created_at ?? n.id)}</p>
                </div>
                <div className="ml-2 flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(n.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleting(n.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit note' : 'Add note'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field.Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
          <Field.Textarea label="Content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your note..." />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={doDelete} title="Delete note" message="This note will be permanently removed." loading={del.isPending} />
    </div>
  )
}