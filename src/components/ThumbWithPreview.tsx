"use client"

/**
 * Small in-row thumbnail that fades up a larger preview on hover.
 *
 * - Desktop hover only (touch devices fall through cleanly because
 *   the preview is gated by `@media (hover: hover)` via the
 *   `[@media(hover:hover)]:` Tailwind variant).
 * - 300ms enter delay so quick mouse passes don't flash previews.
 * - Preview is `pointer-events-none` so it never blocks the row click.
 * - On 404 / hotlink reject, both the thumb and any visible preview
 *   are hidden via the `onError` handler.
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
  const sizeClass = size === 32 ? "w-8 h-8" : "w-10 h-10"
  return (
    <div className={`shrink-0 relative group/thumb ${sizeClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className={`${sizeClass} rounded object-cover bg-gray-100 dark:bg-zinc-800`}
        onError={(e) => { e.currentTarget.parentElement!.style.display = "none" }}
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
