import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'bg-[#F2F2F4] text-[#0A0A0C] hover:bg-[#F2F2F4]/85',
  secondary: 'bg-raised text-[#F2F2F4] hover:bg-checkbox',
  ghost: 'text-text-dim hover:bg-raised hover:text-[#F2F2F4]',
  danger: 'bg-[#EB0028]/15 text-[#FF4D66] hover:bg-[#EB0028]/25 border border-[#EB0028]/30',
  outline: 'border border-checkbox text-[#F2F2F4] hover:bg-raised',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-9 w-9',
}

export interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragEnter' | 'onDragExit' | 'onDragLeave' | 'onDragOver' | 'onDragStart' | 'onDrop'
  > {
  variant?: Variant
  size?: Size
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-chip font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B8CFF]/40 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.12 }}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  )
}
