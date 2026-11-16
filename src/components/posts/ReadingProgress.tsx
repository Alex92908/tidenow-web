"use client"

import { motion, useScroll, useSpring } from "framer-motion"

/**
 * Thin scroll-linked reading progress bar, fixed to the top of the
 * viewport (Phase 3). Spring-smoothed so it glides rather than jumps.
 * Post pages have no sticky site header, so top-0 never covers content.
 */
export function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })
  return (
    <motion.div
      style={{ scaleX }}
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500"
    />
  )
}
