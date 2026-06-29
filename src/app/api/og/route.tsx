// app/api/og/route.tsx
// БЕЗ SVG <text> — весь текст через HTML div'ы

import { ImageResponse } from "@vercel/og";
import { db } from "@/lib/db";
import { OG_COLORS, ogProbabilityColor, ogTierLabel } from "@/lib/og-colors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = (searchParams.get("lang") ?? "ru") as "ru" | "en";

  const agg = await db.aggregate.findFirst({ orderBy: { calcDate: "desc" } });
  const value = agg?.totalProbability ?? 0;
  const dateStr = agg?.calcDate
    ? agg.calcDate.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const formatted = value > 0 ? `+${value}` : `${value}`;
  const color = ogProbabilityColor(value);
  const tier = ogTierLabel(value, lang);
  const title = lang === "en" ? "Peace Index 180" : "Индекс Мира 180";
  const subtitle = lang === "en" ? "180-day peace probability" : "Вероятность мира за 180 дней";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${OG_COLORS.bg_dark} 0%, ${OG_COLORS.bg_card} 100%)`,
          color: OG_COLORS.text_primary,
          fontFamily: "system-ui, sans-serif",
          padding: 40,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${OG_COLORS.high_peace}, ${OG_COLORS.peace_tendency})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
              ☮
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: OG_COLORS.text_primary }}>{title}</div>
              <div style={{ fontSize: 13, color: OG_COLORS.text_secondary }}>{subtitle}</div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: OG_COLORS.text_muted }}>{dateStr}</div>
        </div>

        {/* Content: gauge + text overlay */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 30 }}>

          {/* Gauge area — SVG + HTML overlay */}
          <div style={{ width: 560, height: 380, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {/* SVG — только графика, без текста */}
            <svg width="560" height="380" viewBox="0 0 560 380" style={{ position: "absolute" }}>
              {/* Background arc */}
              <path d="M 60 340 A 220 220 0 0 1 500 340" fill="none" stroke={OG_COLORS.track_bg} strokeWidth="28" />
              {/* Left zone (war) */}
              <path d="M 60 340 A 220 220 0 0 1 170 150" fill="none" stroke={OG_COLORS.war} strokeWidth="28" opacity="0.3" />
              {/* Center-left (escalation) */}
              <path d="M 170 150 A 220 220 0 0 1 280 120" fill="none" stroke={OG_COLORS.escalation} strokeWidth="28" opacity="0.3" />
              {/* Center (stalemate) */}
              <path d="M 280 120 A 220 220 0 0 1 390 150" fill="none" stroke={OG_COLORS.stalemate} strokeWidth="28" opacity="0.3" />
              {/* Center-right (peace tendency) */}
              <path d="M 390 150 A 220 220 0 0 1 500 340" fill="none" stroke={OG_COLORS.peace_tendency} strokeWidth="28" opacity="0.3" />
            </svg>

            {/* HTML overlay — текст поверх SVG */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 10, marginTop: 80 }}>
              <div style={{ fontSize: 72, fontWeight: 700, color, lineHeight: 1 }}>{formatted}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: OG_COLORS.text_secondary, marginTop: 8 }}>{tier}</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: OG_COLORS.text_primary, marginBottom: 4 }}>
              {lang === "en" ? "Index Structure" : "Структура индекса"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: OG_COLORS.finance }} />
              <span style={{ flex: 1, fontSize: 14, color: OG_COLORS.text_secondary }}>{lang === "en" ? "Int'l Finance" : "Международные финансы"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: OG_COLORS.finance }}>+12.5</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: OG_COLORS.law }} />
              <span style={{ flex: 1, fontSize: 14, color: OG_COLORS.text_secondary }}>{lang === "en" ? "Legislation" : "Законодательство"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: OG_COLORS.law }}>+8.3</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: OG_COLORS.escalation_group }} />
              <span style={{ flex: 1, fontSize: 14, color: OG_COLORS.text_secondary }}>{lang === "en" ? "Escalation Risk" : "Риск эскалации"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: OG_COLORS.escalation_group }}>-15.2</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: OG_COLORS.ukraine_military }} />
              <span style={{ flex: 1, fontSize: 14, color: OG_COLORS.text_secondary }}>{lang === "en" ? "UA Military" : "Военные маркеры UA"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: OG_COLORS.ukraine_military }}>-5.1</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: OG_COLORS.russia }} />
              <span style={{ flex: 1, fontSize: 14, color: OG_COLORS.text_secondary }}>{lang === "en" ? "Russia" : "Маркеры РФ"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: OG_COLORS.russia }}>-3.8</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: OG_COLORS.politics }} />
              <span style={{ flex: 1, fontSize: 14, color: OG_COLORS.text_secondary }}>{lang === "en" ? "Politics" : "Политика"}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: OG_COLORS.politics }}>+2.1</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${OG_COLORS.track_bg}` }}>
          <div style={{ fontSize: 13, color: OG_COLORS.text_muted }}>
            {lang === "en" ? "AI-powered analytics based on open data" : "AI-аналитика на основе открытых данных"}
          </div>
          <div style={{ fontSize: 12, color: OG_COLORS.text_url }}>
            peace-index-180.vercel.app
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

