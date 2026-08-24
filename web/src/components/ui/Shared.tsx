import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

export function Badge({
  children,
  className,
  color,
}: {
  children: ReactNode
  className?: string
  color?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        !color && 'bg-white/10 text-white/70',
        className
      )}
      style={
        color
          ? { backgroundColor: `${color}1a`, color }
          : undefined
      }
    >
      {children}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="mb-4 h-10 w-10 text-white/15" />}
      <p className="text-base font-medium text-white/60">{title}</p>
      {subtitle && <p className="mt-1.5 text-sm text-white/35">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  color,
  compact,
}: {
  label: string
  value: string
  change?: string
  changeLabel?: string
  color?: string
  compact?: boolean
}) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-[#101010]', compact ? 'p-4' : 'p-5')}>
      <p className="text-xs font-medium text-white/50">{label}</p>
      <p
        className={cn(
          'mt-1 font-bold tracking-tight text-white',
          compact ? 'text-2xl' : 'text-3xl'
        )}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {(change || changeLabel) && (
        <p className="mt-1 text-xs text-white/40">
          {change && (
            <span className={change.startsWith('+') ? 'text-[#59D6C7]' : change.startsWith('-') ? 'text-[#FF887D]' : undefined}>
              {change}
            </span>
          )}
          {changeLabel && <span>{change ? ' · ' : ''}{changeLabel}</span>}
        </p>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-white/5', className)} />
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  )
}