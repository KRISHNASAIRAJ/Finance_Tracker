import { forwardRef, useId } from 'react'
import { cn } from '../../lib/utils'

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }
>(function Input({ label, hint, className, id, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-white/60">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white',
          'placeholder:text-white/30 focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10',
          className
        )}
        {...rest}
      />
      {hint && <p className="text-[11px] text-white/35">{hint}</p>}
    </div>
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
>(function Textarea({ label, className, id, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-white/60">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          'min-h-[90px] w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white',
          'placeholder:text-white/30 focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10',
          className
        )}
        {...rest}
      />
    </div>
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: Array<{ value: string; label: string }> }
>(function Select({ label, options, className, id, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-white/60">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={cn(
          'h-10 w-full rounded-xl border border-white/10 bg-[#161616] px-3 text-sm text-white',
          'focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10',
          className
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#161616] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
})

export const Field = {
  Input,
  Textarea,
  Select,
}
