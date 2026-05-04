"use client"

import { useTranslations } from "next-intl"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { sourceMeta, getColumns } from "@/sources/metadata"
import type { SourceColumn } from "@/lib/types"

interface SidebarProps {
  order: string[]
  setOrder: (order: string[]) => void
  activeFilter: SourceColumn | "all"
  setActiveFilter: (f: SourceColumn | "all") => void
  locale: string
  open: boolean
  onToggle: () => void
  mobileMode?: boolean
  onItemClick?: () => void
}

export function SourceSidebar({
  order,
  setOrder,
  activeFilter,
  setActiveFilter,
  locale,
  open,
  onToggle,
  mobileMode = false,
  onItemClick,
}: SidebarProps) {
  const t = useTranslations("sources")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = order.indexOf(String(active.id))
      const newIdx = order.indexOf(String(over.id))
      setOrder(arrayMove(order, oldIdx, newIdx))
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-center pt-2 w-10 h-full">
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-xs"
          title="展开侧边栏"
        >
          ›
        </button>
      </div>
    )
  }

  return (
    <aside className={mobileMode ? "flex flex-col w-full" : "flex flex-col w-52 h-[calc(100vh-3.5rem)] sticky top-14 overflow-hidden"}>
      {/* Header row — desktop only */}
      {!mobileMode && (
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-white/[0.05]">
          <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
            {locale === "zh" ? "来源" : "Sources"}
          </span>
          <button
            onClick={onToggle}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-xs"
            title="收起"
          >
            ‹
          </button>
        </div>
      )}

      {/* "All" row */}
      <button
        onClick={() => setActiveFilter("all")}
        className={[
          "flex items-center gap-2 mx-2 mt-2 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all",
          activeFilter === "all"
            ? "bg-gray-200 dark:bg-zinc-700/70 text-gray-900 dark:text-white"
            : "text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]",
        ].join(" ")}
      >
        <span className="text-base leading-none">🌐</span>
        <span>{locale === "zh" ? "全部" : "All"}</span>
        <span className="ml-auto text-[10px] text-gray-400 dark:text-zinc-500">{order.length}</span>
      </button>

      {/* Scrollable source list */}
      <div className={`${mobileMode ? "" : "flex-1"} overflow-y-auto thin-scroll mt-1 pb-4`}>
        <DndContext
          id="source-sidebar-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {getColumns(locale).filter((col) => activeFilter === "all" || activeFilter === col.id).map((col) => {
              const colIds = order.filter((id) => sourceMeta[id]?.column === col.id)
              if (colIds.length === 0) return null
              return (
                <div key={col.id} className="mt-3">
                  {/* Category header */}
                  <button
                    onClick={() => setActiveFilter(col.id)}
                    className={[
                      "w-full flex items-center justify-between px-3 py-1 mb-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors",
                      activeFilter === col.id
                        ? "text-gray-900 dark:text-zinc-100"
                        : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200",
                    ].join(" ")}
                  >
                    <span>{locale === "zh" ? col.label : col.labelEn}</span>
                    <span className="text-gray-400 dark:text-zinc-500 font-normal normal-case tracking-normal text-[10px]">
                      {colIds.length}
                    </span>
                  </button>

                  {/* Source items */}
                  {colIds.map((id) => (
                    <SortableItem
                      key={id}
                      id={id}
                      name={t(id)}
                      icon={sourceMeta[id]?.icon ?? ""}
                      accentColor={sourceMeta[id]?.accentColor ?? ""}
                      isActive={activeFilter === col.id}
                      onItemClick={onItemClick}
                    />
                  ))}
                </div>
              )
            })}
          </SortableContext>
        </DndContext>
      </div>
    </aside>
  )
}

function SortableItem({
  id,
  name,
  icon,
  accentColor,
  isActive,
  onItemClick,
}: {
  id: string
  name: string
  icon: string
  accentColor: string
  isActive: boolean
  onItemClick?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function scrollToCard() {
    if (isDragging) return
    onItemClick?.()
    const el = document.getElementById(`source-card-${id}`)
    if (!el) return
    if (window.innerWidth < 768) {
      el.parentElement?.scrollTo({ left: el.offsetLeft, behavior: "smooth" })
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={scrollToCard}
      className={[
        "group flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg text-[12px] transition-all select-none cursor-pointer",
        isDragging
          ? "bg-gray-100 dark:bg-zinc-800/80 shadow-lg shadow-black/20 dark:shadow-black/40 opacity-90 z-50"
          : isActive
          ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800/60"
          : "text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]",
      ].join(" ")}
    >
      {/* Accent dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${accentColor} opacity-70`}
      />
      {/* Icon + name */}
      <span className="text-sm leading-none">{icon}</span>
      <span className="flex-1 truncate">{name}</span>
      {/* Drag handle */}
      <span
        {...listeners}
        {...attributes}
        className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-300 dark:text-zinc-700 hover:text-gray-500 dark:hover:text-zinc-500 transition-opacity text-[10px] px-0.5"
        title="拖动排序"
      >
        ⋮⋮
      </span>
    </div>
  )
}
