"use client"

import { useState } from "react"

/**
 * Small in-row thumbnail that fades up a larger preview on hover.
 *
 * - Desktop hover only (touch devices fall through cleanly because
 *   the preview is gated by `@media (hover: hover)` via the
 *   `[@media(hover:hover)]:` Tailwind variant).
 * - 300ms enter delay so quick mouse passes don't flash previews.
 * - Preview is `pointer-events-none` so it never blocks the row click.
 * - On 404 / hotlink reject, the entire thumb is unmounted via React
 *   state (so the layout reclaims the space cleanly — no broken-image
 *   icon, no half-collapsed row).
 */
export function ThumbWithPreview({
  src,
  srcLarge,
  size = 40,
}: {
  src: string
  srcLarge?: string
  size?: 32 | 40
}) {
  // Two-stage fallback: try the small src first (fast). If it errors —
  // usually a 403/hotlink reject from a thumb-specific CDN like
  // b.thumbs.redditmedia.com — try the larger variant which often comes
  // from a more permissive host (i.redd.it, img.tmdb.org, etc). Only after
  // BOTH fail do we unmount and reclaim the space.
  const hasFallback = !!srcLarge && srcLarge !== src
  const [stage, setStage] = useState<"primary" | "fallback" | "failed">("primary")
  if (stage === "failed") return null
  const currentSrc = stage === "primary" ? src : srcLarge!
  const sizeClass = size === 32 ? "w-8 h-8" : "w-10 h-10"
  return (
    <div className={`shrink-0 relative group/thumb ${sizeClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc}
        alt=""
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className={`${sizeClass} rounded object-cover bg-gray-100 dark:bg-zinc-800`}
        onError={() => {
          if (stage === "primary" && hasFallback) setStage("fallback")
          else setStage("failed")
        }}
      />
      {/* Hover preview — only attaches on real pointer devices */}
      <div
        className={[
          "hidden [@media(hover:hover)]:block",
          "absolute left-full top-0 ml-2 z-50 pointer-events-none",
          "opacity-0 group-hover/thumb:opacity-100",
          "transition-opacity duration-0 group-hover/thumb:duration-200",
          "[transition-delay:0ms] group-hover/thumb:[transition-delay:300ms]",
        ].join(" ")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={srcLarge ?? src}
          alt=""
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="max-w-[200px] max-h-[280px] rounded-lg object-cover shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-zinc-900"
        />
      </div>
    </div>
  )
}
