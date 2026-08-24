/**
 * Toast — lightweight global toast notifications.
 */
import { create } from 'zustand'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string) => void
  remove: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (msg: string) => useToastStore.getState().push('success', msg),
  error: (msg: string) => useToastStore.getState().push('error', msg),
  info: (msg: string) => useToastStore.getState().push('info', msg),
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pop-in flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm text-white shadow-2xl"
        >
          {t.kind === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#59D6C7]" />}
          {t.kind === 'error' && <XCircle className="h-4 w-4 shrink-0 text-[#FF887D]" />}
          {t.kind === 'info' && <Info className="h-4 w-4 shrink-0 text-[#9BA5FF]" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}