"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

// Retry button for the /source/[id] error state. router.refresh()
// re-renders the server component from the server (bypassing the client
// router cache), so the page re-attempts its live fetch instead of
// showing the same cached error page a plain link would.
export function RetryButton({ label }: { label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        router.refresh()
        // If the refresh takes a while, re-enable so the user can try again.
        setTimeout(() => setBusy(false), 3000)
      }}
      className="inline-block px-4 py-2 text-sm font-medium rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white shadow-sm transition-colors"
    >
      {busy ? "…" : label}
    </button>
  )
}
