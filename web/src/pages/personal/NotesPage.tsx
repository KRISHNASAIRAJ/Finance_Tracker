import { useEffect, useMemo, useState } from 'react'
import { Folder, FolderOpen, Pin, PinOff, Plus, Search, Trash2, Undo2, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useNotes, useUpsertNote, useDeleteNote } from '../../hooks/data/usePersonal'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { cn } from '../../lib/utils'
import type { Note } from '../../types'

const ALL = 'All Notes'
const DELETED = 'Recently Deleted'

function folderOf(n: Note): string {
  return n.deleted_at ? DELETED : n.folder || 'Notes'
}

function timeLabel(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function NotesPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: notes, isLoading } = useNotes(userId)
  const upsert = useUpsertNote(userId)
  const del = useDeleteNote(userId)

  const [openFolder, setOpenFolder] = useState<string>(ALL)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Folders with counts
  const folders = useMemo(() => {
    const alive = (notes ?? []).filter((n) => !n.deleted_at)
    const counts = new Map<string, number>()
    for (const n of alive) {
      const f = n.folder || 'Notes'
      counts.set(f, (counts.get(f) ?? 0) + 1)
    }
    const custom = [...counts.keys()].filter((f) => f !== 'Notes').sort()
    const out: Array<{ name: string; count: number }> = [{ name: ALL, count: alive.length }]
    for (const f of custom) out.push({ name: f, count: counts.get(f) ?? 0 })
    out.push({ name: 'Notes', count: counts.get('Notes') ?? 0 })
    out.push({ name: DELETED, count: (notes ?? []).filter((n) => n.deleted_at).length })
    return out
  }, [notes])

  const visible = useMemo(() => {
    let list = (notes ?? []).filter((n) =>
      openFolder === ALL ? !n.deleted_at : folderOf(n) === openFolder
    )
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((n) => n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    })
  }, [notes, openFolder, search])

  const current = (notes ?? []).find((n) => n.id === selected) ?? null
  const [draft, setDraft] = useState<{ title: string; content: string }>({ title: '', content: '' })
  const [dirty, setDirty] = useState(false)

  // Debounced autosave while typing (Apple Notes parity)
  useEffect(() => {
    if (!dirty || !current) return
    const t = window.setTimeout(() => {
      upsert.mutate({
        id: current.id,
        row: { title: draft.title || 'New Note', content: draft.content, updated_at: new Date().toISOString() },
      })
      setDirty(false)
    }, 1200)
    return () => window.clearTimeout(t)
  }, [draft, dirty, current, upsert])

  const select = (n: Note | null) => {
    if (dirty && current) {
      upsert.mutate({
        id: current.id,
        row: { title: draft.title || 'New Note', content: draft.content, updated_at: new Date().toISOString() },
      })
    }
    setSelected(n?.id ?? null)
    setDraft({ title: n?.title ?? '', content: n?.content ?? '' })
    setDirty(false)
  }

  const newNote = () => {
    const folder = openFolder !== ALL && openFolder !== DELETED ? openFolder : 'Notes'
    select(null)
    upsert.mutate(
      { row: { title: 'New Note', content: '', folder, pinned: false, updated_at: new Date().toISOString() } },
      {
        onSuccess: (rowId) => {
          if (rowId) setSelected(rowId as string)
        },
      }
    )
  }

  const togglePin = (n: Note) =>
    upsert.mutate({ id: n.id, row: { pinned: !n.pinned, updated_at: new Date().toISOString() } })

  const trash = (n: Note) => {
    upsert.mutate({ id: n.id, row: { deleted_at: new Date().toISOString(), pinned: false } })
    if (selected === n.id) setSelected(null)
  }
  const restore = (n: Note) =>
    upsert.mutate({ id: n.id, row: { deleted_at: null } })
  const purge = (n: Note) => {
    del.mutate(n.id)
    if (selected === n.id) setSelected(null)
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        subtitle="Folders · pinned · recently deleted · autosave"
        action={
          <button
            onClick={newNote}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90"
          >
            <Plus className="h-3.5 w-3.5" /> New note
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_300px_1fr]">
        {/* Folders pane */}
        <div className="space-y-0.5 rounded-xl border border-white/10 bg-white/[0.02] p-2">
          {folders.map((f) => (
            <button
              key={f.name}
              onClick={() => { setOpenFolder(f.name); setSelected(null) }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                openFolder === f.name ? 'bg-[#9BA5FF]/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              {openFolder === f.name ? (
                <FolderOpen className="h-4 w-4 text-[#9BA5FF]" />
              ) : (
                <Folder className={cn('h-4 w-4', f.name === DELETED ? 'text-white/30' : 'text-[#59D6C7]')} />
              )}
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-white/30 tnum">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Notes list pane */}
        <div className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02]">
          {openFolder !== DELETED && (
            <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
              <Search className="h-3.5 w-3.5 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/25"
              />
              {search && (
                <button onClick={() => setSearch('')}><X className="h-3.5 w-3.5 text-white/30" /></button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-1.5">
            {visible.length === 0 && (
              <p className="py-10 text-center text-sm text-white/25">
                {openFolder === DELETED ? 'Nothing deleted' : search ? 'No matches' : 'No notes'}
              </p>
            )}
            {visible.map((n) => (
              <button
                key={n.id}
                onClick={() => select(n)}
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                  selected === n.id ? 'bg-[#9BA5FF]/15' : 'hover:bg-white/5'
                )}
              >
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Pin className="h-3 w-3 shrink-0 text-[#FFD9A0]" />}
                  <span className="flex-1 truncate text-sm font-semibold text-white/85">{n.title || 'New Note'}</span>
                  <span className="text-[10px] text-white/30">{timeLabel(n.updated_at ?? n.created_at)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-white/40">
                  {(n.content ?? '').replace(/\n+/g, ' ').trim() || 'No additional text'}
                </p>
                {n.deleted_at ? (
                  <div className="mt-1.5 flex gap-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); restore(n) }}
                      className="flex items-center gap-1 rounded-md bg-[#59D6C7]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#59D6C7] hover:bg-[#59D6C7]/20"
                    >
                      <Undo2 className="h-3 w-3" /> Recover
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); purge(n) }}
                      className="flex items-center gap-1 rounded-md bg-[#FF887D]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF887D] hover:bg-[#FF887D]/20"
                    >
                      <Trash2 className="h-3 w-3" /> Delete forever
                    </span>
                  </div>
                ) : (
                  <div className="mt-1.5 flex gap-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); togglePin(n) }}
                      className="flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-white/50 hover:bg-white/10"
                    >
                      {n.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />} {n.pinned ? 'Unpin' : 'Pin'}
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); trash(n) }}
                      className="flex items-center gap-1 rounded-md bg-[#FF887D]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF887D] hover:bg-[#FF887D]/20"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Editor pane */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          {current ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
                <span className="text-xs text-white/35">{current.folder || 'Notes'}</span>
                <div className="flex items-center gap-3">
                  {!current.deleted_at && (
                    <button onClick={() => togglePin(current)} className="text-white/40 hover:text-[#FFD9A0]">
                      <Pin className={cn('h-4 w-4', current.pinned && 'text-[#FFD9A0]')} />
                    </button>
                  )}
                  {current.deleted_at ? (
                    <button onClick={() => restore(current)} className="flex items-center gap-1 text-xs text-[#59D6C7] hover:underline">
                      <Undo2 className="h-3.5 w-3.5" /> Recover
                    </button>
                  ) : (
                    <button onClick={() => trash(current)} className="text-white/40 hover:text-[#FF887D]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-3 p-5">
                <input
                  value={draft.title}
                  onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); setDirty(true) }}
                  className="w-full bg-transparent text-xl font-bold text-white outline-none"
                  placeholder="Title"
                />
                <textarea
                  value={draft.content}
                  onChange={(e) => { setDraft((d) => ({ ...d, content: e.target.value })); setDirty(true) }}
                  className="min-h-[280px] w-full resize-none bg-transparent text-sm leading-relaxed text-white/80 outline-none"
                  placeholder="Start writing…"
                />
              </div>
              {dirty && (
                <div className="border-t border-white/8 px-5 py-2 text-[11px] text-white/30">
                  Saving on switch… (autosave)
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[280px] items-center justify-center">
              <EmptyState icon={Plus} title="No note selected" subtitle="Pick a note or create a new one" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
