// Canvas rendering for Distribute: branded cover cards (PNG download)
// and video slideshow slides. Browser-only (Canvas 2D API) — kept in its
// own module so src/lib/distribute.ts stays pure and node-testable.
// No new dependencies; everything is drawn with the 2D context.

export interface CoverOpts {
  title: string
  hook: string
  url: string
  date: string
  width: number
  height: number
}

export interface SlideOpts {
  /** Short on-screen text for this scene. */
  text: string
  /** Scene index (0-based) and total scene count. */
  index: number
  total: number
  /** Full draft title (title card / end card only). */
  title: string
  hook: string
  url: string
  width: number
  height: number
  /** Fade alpha 0–1 (playback fades scenes in/out). */
  alpha?: number
  kind: "title" | "point" | "end"
}

const FONT_STACK = `system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`

/** Split text into wrappable tokens: CJK characters are individual
 *  tokens (they can break anywhere), Latin words stay whole. */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  let word = ""
  const flush = () => {
    if (word) tokens.push(word)
    word = ""
  }
  for (const ch of text) {
    if (/\s/.test(ch)) {
      flush()
    } else if (/[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/.test(ch)) {
      flush()
      tokens.push(ch)
    } else {
      word += ch
    }
  }
  flush()
  return tokens
}

/** Greedy word wrap by measured width. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const tokens = tokenize(text)
  const lines: string[] = []
  let cur = ""
  for (const tok of tokens) {
    const trial = cur ? `${cur}${/[\u2e80-\u9fff]/.test(tok) ? "" : " "}${tok}` : tok
    if (ctx.measureText(trial).width <= maxWidth || !cur) {
      cur = trial
    } else {
      lines.push(cur)
      cur = tok
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  weight: number
): number {
  let px = startPx
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${FONT_STACK}`
    if (ctx.measureText(text).width <= maxWidth) return px
    px -= 2
  }
  return minPx
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hueShift: number
) {
  // Deep navy → violet diagonal gradient, with two soft glow blobs so
  // the card reads as designed, not a flat fill.
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, "#0b1026")
  g.addColorStop(0.55, "#1b1440")
  g.addColorStop(1, "#3b1d5e")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  const blob = (x: number, y: number, r: number, color: string) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, color)
    rg.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = rg
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const accent = hueShift % 2 === 0 ? "rgba(56,189,248,0.28)" : "rgba(167,139,250,0.30)"
  blob(w * 0.85, h * 0.1, w * 0.45, accent)
  blob(w * 0.08, h * 0.95, w * 0.4, "rgba(236,72,153,0.20)")
}

function paintWordmark(ctx: CanvasRenderingContext2D, w: number, pad: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = "#38bdf8"
  ctx.fillRect(pad, pad + 2, 10, 10)
  ctx.fillStyle = "#e2e8f0"
  ctx.font = `700 ${Math.max(13, pad * 0.32)}px ${FONT_STACK}`
  ctx.textBaseline = "middle"
  ctx.fillText("TIDENOW", pad + 18, pad + 7)
  ctx.restore()
}

function paintFooter(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number, url: string, date: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = "rgba(226,232,240,0.55)"
  ctx.font = `${Math.max(12, pad * 0.28)}px ${FONT_STACK}`
  ctx.textBaseline = "middle"
  ctx.fillText(url.replace(/^https?:\/\//, ""), pad, h - pad - 4)
  const dw = ctx.measureText(date).width
  ctx.fillText(date, w - pad - dw, h - pad - 4)
  ctx.restore()
}

/** Branded cover card: title + hook + wordmark + URL. Draws at the
 *  canvas's own pixel size (set width/height before calling). */
export function drawCoverCard(canvas: HTMLCanvasElement, opts: CoverOpts) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const { width: w, height: h } = opts
  canvas.width = w
  canvas.height = h
  const pad = Math.round(w * 0.06)

  paintBackground(ctx, w, h, 0)
  paintWordmark(ctx, w, pad, 1)

  // Title: big, bold, wrapped to ≤ 4 lines.
  const titleMaxW = w - pad * 2
  const titlePx = fitFontSize(ctx, opts.title, titleMaxW, Math.round(w * 0.072), Math.round(w * 0.032), 800)
  ctx.font = `800 ${titlePx}px ${FONT_STACK}`
  ctx.fillStyle = "#f8fafc"
  ctx.textBaseline = "top"
  let lines = wrapLines(ctx, opts.title, titleMaxW)
  if (lines.length > 4) {
    lines = lines.slice(0, 4)
    lines[3] = lines[3].replace(/…?$/, "…")
  }
  const lineH = titlePx * 1.22
  let y = h * 0.26
  for (const line of lines) {
    ctx.fillText(line, pad, y)
    y += lineH
  }

  // Accent rule under the title.
  ctx.fillStyle = "#38bdf8"
  ctx.fillRect(pad, y + titlePx * 0.25, Math.round(w * 0.12), 4)

  // Hook line, smaller and muted.
  if (opts.hook) {
    const hookPx = Math.round(w * 0.026)
    ctx.font = `400 ${hookPx}px ${FONT_STACK}`
    ctx.fillStyle = "rgba(203,213,225,0.85)"
    const hookLines = wrapLines(ctx, opts.hook, titleMaxW).slice(0, 2)
    let hy = y + titlePx * 0.55
    for (const line of hookLines) {
      ctx.fillText(line, pad, hy)
      hy += hookPx * 1.5
    }
  }

  paintFooter(ctx, w, h, pad, opts.url, opts.date, 1)
}

/** One slideshow slide. `kind` picks the layout: title card (big title
 *  + hook), point slide (scene number + big on-screen text), end card
 *  (wordmark + URL). */
export function drawSlide(canvas: HTMLCanvasElement, opts: SlideOpts) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const { width: w, height: h } = opts
  canvas.width = w
  canvas.height = h
  const pad = Math.round(w * 0.07)
  const alpha = opts.alpha ?? 1

  ctx.save()
  ctx.globalAlpha = alpha
  paintBackground(ctx, w, h, opts.index)

  if (opts.kind === "title") {
    paintWordmark(ctx, w, pad, 1)
    const titleMaxW = w - pad * 2
    const titlePx = fitFontSize(ctx, opts.title, titleMaxW, Math.round(w * 0.075), Math.round(w * 0.03), 800)
    ctx.font = `800 ${titlePx}px ${FONT_STACK}`
    ctx.fillStyle = "#f8fafc"
    ctx.textBaseline = "top"
    let lines = wrapLines(ctx, opts.title, titleMaxW)
    if (lines.length > 4) lines = lines.slice(0, 4)
    const lineH = titlePx * 1.25
    let y = h * 0.3
    for (const line of lines) {
      ctx.fillText(line, pad, y)
      y += lineH
    }
    ctx.fillStyle = "#38bdf8"
    ctx.fillRect(pad, y + titlePx * 0.3, Math.round(w * 0.12), 4)
    if (opts.hook) {
      const hookPx = Math.round(w * 0.027)
      ctx.font = `400 ${hookPx}px ${FONT_STACK}`
      ctx.fillStyle = "rgba(203,213,225,0.85)"
      const hookLines = wrapLines(ctx, opts.hook, titleMaxW).slice(0, 2)
      let hy = y + titlePx * 0.6
      for (const line of hookLines) {
        ctx.fillText(line, pad, hy)
        hy += hookPx * 1.5
      }
    }
  } else if (opts.kind === "end") {
    // End card: centered wordmark + URL.
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#38bdf8"
    ctx.font = `800 ${Math.round(w * 0.05)}px ${FONT_STACK}`
    ctx.fillText("TIDENOW", w / 2, h * 0.38)
    const textPx = fitFontSize(ctx, opts.text, w - pad * 2, Math.round(w * 0.055), Math.round(w * 0.028), 700)
    ctx.font = `700 ${textPx}px ${FONT_STACK}`
    ctx.fillStyle = "#f8fafc"
    const lines = wrapLines(ctx, opts.text, w - pad * 2)
    let y = h * 0.5
    for (const line of lines) {
      ctx.fillText(line, w / 2, y)
      y += textPx * 1.3
    }
    ctx.fillStyle = "rgba(226,232,240,0.75)"
    ctx.font = `${Math.round(w * 0.024)}px ${FONT_STACK}`
    ctx.fillText(opts.url.replace(/^https?:\/\//, ""), w / 2, h * 0.68)
    ctx.textAlign = "left"
  } else {
    // Point slide: scene counter top-left, big centered on-screen text.
    paintWordmark(ctx, w, pad, 0.9)
    ctx.fillStyle = "rgba(226,232,240,0.6)"
    ctx.font = `${Math.max(13, Math.round(w * 0.022))}px ${FONT_STACK}`
    ctx.textBaseline = "middle"
    const counter = `${String(opts.index).padStart(2, "0")} / ${String(opts.total).padStart(2, "0")}`
    const cw = ctx.measureText(counter).width
    ctx.fillText(counter, w - pad - cw, pad + 7)

    const textPx = fitFontSize(ctx, opts.text, w - pad * 2, Math.round(w * 0.068), Math.round(w * 0.03), 800)
    ctx.font = `800 ${textPx}px ${FONT_STACK}`
    ctx.fillStyle = "#f8fafc"
    ctx.textBaseline = "top"
    const lines = wrapLines(ctx, opts.text, w - pad * 2).slice(0, 4)
    const lineH = textPx * 1.3
    let y = h / 2 - (lines.length * lineH) / 2
    ctx.textAlign = "center"
    for (const line of lines) {
      ctx.fillText(line, w / 2, y)
      y += lineH
    }
    ctx.textAlign = "left"
  }

  // Progress bar along the bottom.
  const progress = opts.total > 1 ? opts.index / (opts.total - 1) : 1
  ctx.fillStyle = "rgba(255,255,255,0.15)"
  ctx.fillRect(0, h - 6, w, 6)
  ctx.fillStyle = "#38bdf8"
  ctx.fillRect(0, h - 6, w * progress, 6)

  ctx.restore()
}

/** Trigger a PNG download of a canvas. */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, "image/png")
}
