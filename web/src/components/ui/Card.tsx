import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

export function Card({
  children,
  className,
  onClick,
  hover = false,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-white/10 bg-[#101010]',
        hover && 'cursor-pointer transition-colors hover:border-white/25',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}
