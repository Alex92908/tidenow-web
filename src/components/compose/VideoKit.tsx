// Video kit for the Distribute panel: storyboard → canvas slideshow
// preview → .webm export (canvas.captureStream + MediaRecorder) + .srt
// subtitles + narration script.
//
// The video is SILENT — the narration is provided as script + SRT for
// the user to add in CapCut / 剪映. No server-side rendering, no new
// secrets. If MediaRecorder is unavailable the download button is
// disabled with a note instead of failing silently.

"use client"

import { useEffect, useRef, useState } from "react"
import type { Scene } from "@/lib/distribute"
import {
  buildNarrationScript,
  buildSrt,
  sceneDurationSec,
  totalDurationSec,
} from "@/lib/distribute"
import { drawSlide } from "@/lib/cover-card"

type Aspect = "9:16" | "16:9"

const ASPECT_SIZE: Record<Aspect, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
}

interface Props {
  title: string
  hook: string
  scenes: Scene[]
  postUrl: string
  locale: "en" | "zh"
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export function VideoKit({ title, hook, scenes, postUrl, locale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [aspect, setAspect] = useState<Aspect>("9:16")
  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0) // 0–1 across the whole video
  const [elapsed, setElapsed] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState("")
  const [copied, setCopied] = useState<"script" | null>(null)
  const [srtReady, setSrtReady] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const durations = scenes.map((s) => sceneDurationSec(s, locale))
  const total = totalDurationSec(scenes, locale)
  const { w, h } = ASPECT_SIZE[aspect]
  const mediaRecorderSupported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"

  // Draw a single frame for time `t` (seconds into the video).
  function drawAt(t: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    let acc = 0
    let idx = scenes.length - 1
    let local = durations[durations.length - 1]
    for (let i = 0; i < scenes.length; i++) {
      if (t < acc + durations[i] || i === scenes.length - 1) {
        idx = i
        local = t - acc
        break
      }
      acc += durations[i]
    }
    // 0.3s fade in, 0.3s fade out per scene.
    const dur = durations[idx]
    const alpha = Math.max(0, Math.min(1, local / 0.3, (dur - local) / 0.3))
    const scene = scenes[idx]
    drawSlide(canvas, {
      text: scene.onScreen,
      index: idx + 1,
      total: scenes.length,
      title,
      hook,
      url: postUrl,
      width: w,
      height: h,
      alpha,
      kind: idx === 0 ? "title" : idx === scenes.length - 1 ? "end" : "point",
    })
  }

  function stopLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  // Redraw the first frame whenever the aspect or scenes change.
  useEffect(() => {
    stopLoop()
    setPlaying(false)
    setRecording(false)
    setProgress(0)
    setElapsed(0)
    drawAt(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, title, scenes])

  // Unmount cleanup: stop recorder + rAF + revoke blob URL.
  useEffect(() => {
    return () => {
      stopLoop()
      if (recorderRef.current?.state === "recording") {
        try {
          recorderRef.current.stop()
        } catch {
          /* already stopped */
        }
      }
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function runPlayback(onDone: () => void, onTick?: (t: number) => void) {
    stopLoop()
    const start = performance.now()
    const tick = (now: number) => {
      const t = (now - start) / 1000
      if (t >= total) {
        drawAt(total - 0.01)
        setProgress(1)
        setElapsed(total)
        onTick?.(total)
        onDone()
        return
      }
      drawAt(t)
      setProgress(t / total)
      setElapsed(t)
      onTick?.(t)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function handlePlayPause() {
    if (playing) {
      stopLoop()
      setPlaying(false)
      return
    }
    setPlaying(true)
    runPlayback(() => setPlaying(false))
  }

  function pickMimeType(): string {
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "",
    ]
    for (const m of candidates) {
      if (!m) return ""
      try {
        if (MediaRecorder.isTypeSupported(m)) return m
      } catch {
        /* ignore */
      }
    }
    return ""
  }

  async function handleRecord() {
    const canvas = canvasRef.current
    if (!canvas || recording) return
    if (!mediaRecorderSupported) {
      setNote(
        locale === "zh"
          ? "当前浏览器不支持 MediaRecorder，无法导出视频。建议用 Chrome / Edge 桌面版。"
          : "This browser doesn't support MediaRecorder, so video export is unavailable. Try Chrome / Edge on desktop."
      )
      return
    }
    setNote(null)
    setVideoUrl(null)
    chunksRef.current = []
    const stream = canvas.captureStream(30)
    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      setNote(
        locale === "zh"
          ? "无法启动录制（浏览器不支持该编码）。"
          : "Could not start recording (encoding not supported by this browser)."
      )
      return
    }
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      const url = URL.createObjectURL(blob)
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      setVideoUrl(url)
      setVideoName(`tidenow-video-${aspect === "9:16" ? "vertical" : "horizontal"}.webm`)
      setRecording(false)
      setPlaying(false)
    }
    setRecording(true)
    setPlaying(true)
    recorder.start(250)
    // Play through once; the recorder stops when playback ends.
    runPlayback(() => {
      if (recorder.state === "recording") recorder.stop()
    })
  }

  function downloadSrt() {
    const srt = buildSrt(scenes, locale)
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "tidenow-narration.srt"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    setSrtReady(true)
    setTimeout(() => setSrtReady(false), 2000)
  }

  async function copyScript() {
    await navigator.clipboard.writeText(buildNarrationScript(scenes))
    setCopied("script")
    setTimeout(() => setCopied(null), 1500)
  }

  const over60 = total > 60
  const script = buildNarrationScript(scenes)

  const hints: { name: string; hint: string }[] =
    locale === "zh"
      ? [
          { name: "抖音", hint: "竖屏 9:16，建议 ≤60 秒，标题加 #话题，手机 App 发布" },
          { name: "TikTok", hint: "竖屏 9:16，建议 ≤60 秒，加 hashtags，手机 App 发布" },
          { name: "Bilibili", hint: "横屏 16:9，填标题 + 简介 + 分区标签，支持 4K" },
          { name: "YouTube", hint: "横屏 16:9，填标题 + 简介；想发 Shorts 用竖屏 ≤60 秒" },
        ]
      : [
          { name: "Douyin", hint: "Vertical 9:16, keep ≤ 60s, add #topics, post from the phone app" },
          { name: "TikTok", hint: "Vertical 9:16, keep ≤ 60s, add hashtags, post from the app" },
          { name: "Bilibili", hint: "Horizontal 16:9, add title + description + category tags" },
          { name: "YouTube", hint: "Horizontal 16:9 with title + description; use vertical ≤ 60s for Shorts" },
        ]

  return (
    <div className="flex flex-col gap-4">
      {/* Storyboard */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
          {locale === "zh" ? `🎬 分镜 · ${scenes.length} 场 · 约 ${fmtClock(total)}` : `🎬 Storyboard · ${scenes.length} scenes · ~${fmtClock(total)}`}
        </h4>
        <ol className="flex flex-col gap-1.5">
          {scenes.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.03] text-xs leading-snug"
            >
              <span className="shrink-0 w-5 h-5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-semibold">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-gray-800 dark:text-zinc-200 truncate">
                  {s.onScreen}
                  <span className="ml-2 font-normal text-gray-400 dark:text-zinc-500">
                    {s.visual} · {durations[i]}s
                  </span>
                </span>
                <span className="block text-gray-500 dark:text-zinc-400 mt-0.5">{s.narration}</span>
              </span>
            </li>
          ))}
        </ol>
        {over60 && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
            {locale === "zh"
              ? `⚠️ 总时长 ${fmtClock(total)}，超过 60 秒——抖音 / TikTok 建议剪到 60 秒内（可删 1–2 个分镜，或缩短旁白）。`
              : `⚠️ Total ${fmtClock(total)} exceeds 60s — trim to under 60s for Douyin / TikTok (drop 1–2 scenes or shorten narration).`}
          </p>
        )}
      </div>

      {/* Narration script + SRT */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
            {locale === "zh" ? "🎙️ 旁白脚本" : "🎙️ Narration script"}
          </h4>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copyScript}
              className="px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors"
            >
              {copied === "script"
                ? locale === "zh" ? "✓ 已复制" : "✓ Copied"
                : locale === "zh" ? "📋 复制脚本" : "📋 Copy script"}
            </button>
            <button
              type="button"
              onClick={downloadSrt}
              className="px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors"
            >
              {srtReady
                ? locale === "zh" ? "✓ 已下载" : "✓ Downloaded"
                : locale === "zh" ? "⬇ 字幕 .srt" : "⬇ Subtitles .srt"}
            </button>
          </div>
        </div>
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
          {script}
        </pre>
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-zinc-500 leading-snug">
          {locale === "zh"
            ? "视频本身是静音的——把脚本交给 TTS / 剪映配音，.srt 字幕可直接导入剪映 / CapCut。"
            : "The video is silent — feed the script to a TTS voice or CapCut / 剪映, and import the .srt subtitles there."}
        </p>
      </div>

      {/* Slideshow preview + export */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
            {locale === "zh" ? "🖼️ 幻灯片预览与导出" : "🖼️ Slideshow preview & export"}
          </h4>
          <div className="flex rounded-md border border-gray-200 dark:border-white/10 p-0.5">
            {(["9:16", "16:9"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={recording || playing}
                onClick={() => setAspect(a)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors disabled:opacity-40 ${
                  aspect === a
                    ? "bg-sky-500 text-white"
                    : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                }`}
              >
                {a === "9:16"
                  ? locale === "zh" ? "竖屏 9:16" : "Vertical 9:16"
                  : locale === "zh" ? "横屏 16:9" : "Horizontal 16:9"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div
            className="shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-black"
            style={
              aspect === "9:16"
                ? { width: 180, aspectRatio: "9 / 16" }
                : { width: 320, aspectRatio: "16 / 9" }
            }
          >
            <canvas ref={canvasRef} className="block w-full h-full" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Progress */}
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-sky-500 transition-none" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500">
              {fmtClock(elapsed)} / {fmtClock(total)} · {aspect === "9:16" ? "720×1280" : "1280×720"}
              {recording
                ? locale === "zh" ? " · 🔴 录制中，请保持本页打开…" : " · 🔴 Recording — keep this tab open…"
                : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={recording}
                className="px-3 py-1.5 text-xs rounded-md bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {playing
                  ? locale === "zh" ? "⏸ 暂停" : "⏸ Pause"
                  : locale === "zh" ? "▶ 预览播放" : "▶ Play preview"}
              </button>
              <button
                type="button"
                onClick={handleRecord}
                disabled={recording || playing || !mediaRecorderSupported}
                title={
                  !mediaRecorderSupported
                    ? locale === "zh"
                      ? "当前浏览器不支持视频导出（需要 MediaRecorder）"
                      : "This browser doesn't support video export (MediaRecorder required)"
                    : undefined
                }
                className="px-3 py-1.5 text-xs rounded-md bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {recording
                  ? locale === "zh" ? "🔴 录制中…" : "🔴 Recording…"
                  : locale === "zh" ? "⬇ 录制并下载 .webm" : "⬇ Record & download .webm"}
              </button>
              {videoUrl && (
                <a
                  href={videoUrl}
                  download={videoName}
                  className="px-3 py-1.5 text-xs rounded-md border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                >
                  {locale === "zh" ? "⬇ 下载视频 .webm" : "⬇ Download video .webm"}
                </a>
              )}
            </div>
            {note && <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">{note}</p>}
            {!mediaRecorderSupported && (
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-snug">
                {locale === "zh"
                  ? "当前浏览器不支持 MediaRecorder，视频导出不可用；分镜、脚本和字幕仍可正常使用。建议用 Chrome / Edge 桌面版。"
                  : "MediaRecorder isn't available in this browser, so video export is disabled — storyboard, script, and subtitles still work. Try Chrome / Edge on desktop."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Per-platform posting hints */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
          {locale === "zh" ? "📌 各平台发布提示" : "📌 Posting hints per platform"}
        </h4>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {hints.map((hp) => (
            <li
              key={hp.name}
              className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.03] text-xs leading-snug text-gray-600 dark:text-zinc-400"
            >
              <span className="font-medium text-gray-800 dark:text-zinc-200">{hp.name}：</span>
              {hp.hint}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-zinc-500 leading-snug">
          {locale === "zh"
            ? "目前不做自动发布——各平台需要你自己的账号登录发布（无 OAuth、无凭证托管）。"
            : "No auto-posting — each platform needs your own account to publish (no OAuth, no stored credentials)."}
        </p>
      </div>
    </div>
  )
}
