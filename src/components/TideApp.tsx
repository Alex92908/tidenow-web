"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SourceSidebar } from "./SourceSidebar"
import { TideBoard } from "./TideBoard"
import { SOURCE_IDS, SOURCE_IDS_EN, SOURCE_IDS_ZH } from "@/sources/metadata"
import type { NewsItem, FilterId } from "@/lib/types"

type PreloadedData = Record<string, { items: NewsItem[]; updatedAt: number }>

function mergeOrder(saved: string[], base: string[]): string[] {
  return [
    ...saved.filter((id) => SOURCE_IDS.includes(id)),
    ...base.filter((id) => !saved.includes(id)),
  ]
}

export function TideApp({ locale, initialData }: { locale: string; initialData?: PreloadedData }) {
  const defaultOrder = locale === "zh" ? SOURCE_IDS_ZH : SOURCE_IDS_EN
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [activeFilter, setActiveFilter] = useState<FilterId>("all")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      // One-time migration: an earlier build stored a separate per-board order
      // under "tidenow-source-order". Fold it into the canonical key and clean up.
      const legacy = localStorage.getItem("tidenow-source-order")
      if (legacy && !localStorage.getItem("tidenow-order")) {
        localStorage.setItem("tidenow-order", legacy)
      }
      if (legacy) localStorage.removeItem("tidenow-source-order")
      const saved = localStorage.getItem("tidenow-order")
      if (saved) setOrder(mergeOrder(JSON.parse(saved) as string[], defaultOrder))
    } catch {}
  }, [])

  useEffect(() => {
    if (mounted) localStorage.setItem("tidenow-order", JSON.stringify(order))
  }, [order, mounted])

  const orderDirty = order.length !== defaultOrder.length || order.some((id, i) => id !== defaultOrder[i])
  const resetOrder = () => setOrder(defaultOrder)

  return (
    <div className="flex gap-0">
      {/* Sidebar — hidden on mobile, shown md+ */}
      <div
        className={[
          "hidden md:flex shrink-0 transition-all duration-300",
          sidebarOpen ? "w-52" : "w-10",
        ].join(" ")}
      >
        <SourceSidebar
          order={order}
          setOrder={setOrder}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          locale={locale}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />
      </div>

      {/* Board */}
      <div className="flex-1 min-w-0 md:pl-4">
        <TideBoard
          locale={locale}
          initialData={initialData}
          order={order}
          setOrder={setOrder}
          orderDirty={orderDirty}
          onResetOrder={resetOrder}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          showTabs={!sidebarOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
      </div>

      {/* Mobile bottom drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed top-0 left-0 bottom-0 z-50 md:hidden w-72 bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-white/[0.08] rounded-r-2xl flex flex-col"
            >
              {/* Header + close */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 border-b border-gray-100 dark:border-white/[0.05]">
                <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-400 uppercase tracking-widest">
                  {locale === "zh" ? "来源" : "Sources"}
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto thin-scroll">
                <SourceSidebar
                  order={order}
                  setOrder={setOrder}
                  activeFilter={activeFilter}
                  setActiveFilter={(f) => { setActiveFilter(f); setDrawerOpen(false) }}
                  locale={locale}
                  open
                  onToggle={() => setDrawerOpen(false)}
                  mobileMode
                  onItemClick={() => setDrawerOpen(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
