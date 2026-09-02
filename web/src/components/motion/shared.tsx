/**
 * Shared motion primitives — one easing curve, one stagger rhythm.
 */
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { Variants } from 'framer-motion'

export const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
})

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
}

/**
 * Count-up number that springs to its target when scrolled into view.
 * Respects prefers-reduced-motion by jumping straight to the value.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  style,
}: {
  value: number
  format?: (n: number) => string
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: '-32px' })
  const raw = useMotionValue(0)
  const spring = useSpring(raw, { damping: 28, stiffness: 110, restDelta: 0.4 })
  const text = useTransform(spring, (v) => (format ?? ((n: number) => n.toLocaleString('en-IN')))(Math.round(v)))

  useEffect(() => {
    if (!inView) return
    if (reduce) raw.jump(value)
    else raw.set(value)
  }, [inView, value, reduce, raw])

  return (
    <motion.span ref={ref} className={className} style={style}>
      {text}
    </motion.span>
  )
}
