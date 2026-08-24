import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="backdrop-in absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={cn(
          'pop-in relative w-full rounded-2xl border border-white/10 bg-[#101010] shadow-2xl',
          wide ? 'max-w-2xl' : 'max-w-md'
        )}
      >
        <div className="flex items-start justify-between px-6 pt-5">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-white/15 px-4 text-sm text-white/70 transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={
              danger
                ? 'h-10 rounded-xl bg-[#FF887D]/15 px-4 text-sm font-medium text-[#FF887D] transition-colors hover:bg-[#FF887D]/25 disabled:opacity-50'
                : 'h-10 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50'
            }
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-white/70">{message}</p>
    </Modal>
  )
}
