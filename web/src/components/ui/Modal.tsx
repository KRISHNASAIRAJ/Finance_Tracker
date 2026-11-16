import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
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
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            className={cn(
              'relative w-full rounded-card border border-line-soft bg-card shadow-2xl',
              wide ? 'max-w-2xl' : 'max-w-md'
            )}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
              <div className="flex justify-end gap-3 border-t border-line-soft px-6 py-4">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
            className="h-10 rounded-chip border border-checkbox px-4 text-sm text-text-dim transition-colors hover:bg-raised"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={
              danger
                ? 'h-10 rounded-chip bg-[#EB0028]/15 px-4 text-sm font-medium text-[#FF4D66] transition-colors hover:bg-[#EB0028]/25 disabled:opacity-50'
                : 'h-10 rounded-chip bg-[#F2F2F4] px-4 text-sm font-medium text-[#0A0A0C] transition-colors hover:bg-[#F2F2F4]/85 disabled:opacity-50'
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
