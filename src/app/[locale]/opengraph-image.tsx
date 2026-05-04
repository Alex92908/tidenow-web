import { ImageResponse } from "next/og"
import { getTranslations } from "next-intl/server"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "site" })
  const isZh = locale === "zh"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0f 0%, #0f172a 50%, #0c1a2e 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient blobs */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: 100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            right: 80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          <span style={{ fontSize: 80 }}>🌊</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
            <span style={{ fontSize: 80, fontWeight: 800, color: "#f8fafc", letterSpacing: -2 }}>
              Tide
            </span>
            <span
              style={{
                fontSize: 80,
                fontWeight: 800,
                letterSpacing: -2,
                background: "linear-gradient(90deg, #06b6d4, #3b82f6)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Now
            </span>
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: isZh ? 26 : 24,
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.5,
            padding: "0 40px",
          }}
        >
          {t("description")}
        </div>

        {/* Source pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 48,
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: 900,
          }}
        >
          {["微博", "知乎", "B站", "GitHub", "Reddit", "HN", "YouTube", "抖音"].map((s) => (
            <div
              key={s}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#cbd5e1",
                fontSize: 20,
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
