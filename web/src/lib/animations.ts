import type { Variants, Transition } from 'framer-motion'

export const spring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.8,
}

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 1,
}

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 20,
  mass: 0.6,
}

export const easeOut: Transition = {
  duration: 0.25,
  ease: [0.25, 0.46, 0.45, 0.94],
}

export const easeInOut: Transition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1],
}

// ─── Page Transitions ───────────────────────────────────────────

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.995 },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.995,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

// ─── Stagger Container ──────────────────────────────────────────

export const staggerContainer: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
}

export const staggerContainerSlow: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: {
    opacity: 1,
    y: 0,
    transition: spring,
  },
}

export const staggerItemScale: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring,
  },
}

// ─── Micro-interactions ─────────────────────────────────────────

export const tapScale = {
  whileTap: { scale: 0.96 },
  transition: spring,
}

export const tapScaleSm = {
  whileTap: { scale: 0.98 },
  transition: spring,
}

export const hoverLift = {
  whileHover: { y: -2, transition: { duration: 0.2 } },
}

export const hoverScale = {
  whileHover: { scale: 1.02, transition: { duration: 0.2 } },
}

export const pressScale = {
  whileTap: { scale: 0.95 },
}

// ─── Modal / Sheet ──────────────────────────────────────────────

export const modalBackdrop: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export const modalPanel: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.96 },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springGentle,
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.97,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

export const sheetPanel: Variants = {
  initial: { y: '100%' },
  enter: { y: 0, transition: springGentle },
  exit: { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
}

// ─── List / Row ─────────────────────────────────────────────────

export const listContainer: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.03 } },
}

export const listItem: Variants = {
  initial: { opacity: 0, x: -8 },
  enter: { opacity: 1, x: 0, transition: spring },
}

export const listItemFade: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.3 } },
}

// ─── Chart Animations ───────────────────────────────────────────

export const chartDrawIn: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  enter: {
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 1.2, ease: 'easeInOut' }, opacity: { duration: 0.3 } },
  },
}

export const chartGrowUp: Variants = {
  initial: { scaleY: 0, opacity: 0 },
  enter: {
    scaleY: 1,
    opacity: 1,
    transition: { ...springGentle, delay: 0.1 },
  },
}

export const chartFadeIn: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.6, delay: 0.2 } },
}

// ─── Skeleton / Loading ─────────────────────────────────────────

export const shimmer: Variants = {
  initial: { x: '-100%' },
  animate: {
    x: '100%',
    transition: { duration: 1.5, repeat: Infinity, ease: 'linear' },
  },
}

// ─── Toast / Notification ───────────────────────────────────────

export const toastIn: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  enter: { opacity: 1, y: 0, scale: 1, transition: springBouncy },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.15 } },
}

// ─── Expand / Collapse ──────────────────────────────────────────

export const expandCollapse: Variants = {
  initial: { height: 0, opacity: 0 },
  enter: { height: 'auto', opacity: 1, transition: springGentle },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
}
