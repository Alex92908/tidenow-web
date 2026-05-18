export function formatDistanceToNow(ts: number, locale = "en"): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  const isZh = locale === "zh"

  if (mins < 1) return isZh ? "刚刚" : "just now"
  if (mins < 60) return isZh ? `${mins}分钟前` : `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return isZh ? `${hours}小时前` : `${hours}h ago`
  return isZh ? `${Math.floor(hours / 24)}天前` : `${Math.floor(hours / 24)}d ago`
}
