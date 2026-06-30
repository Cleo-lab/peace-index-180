// app/api/og/route.tsx
// OG-спидометр с реальными сегментами групп

import { ImageResponse } from "next/og";
import { OG_COLORS, ogProbabilityColor, ogTierLabel, ogGroupColor } from "@/lib/og-colors";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// ===== Математика спидометра =====
const CX = 260;
const CY = 180;
const R = 140;
const STROKE = 22;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const p1 = polar(cx, cy, r, a1);
  const p2 = polar(cx, cy, r, a2);
  const largeArc = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function valueToAngle(v: number): number {
  const normalized = Math.max(-100, Math.min(100, v));
  return 225 + ((normalized + 100) / 200) * 270;
}

const MAJOR_TICKS = [-100, -75, -50, -25, 0, 25, 50, 75, 100];
const MINOR_TICKS: number[] = [];
for (let t = -95; t <= 95; t += 5) {
  if (!MAJOR_TICKS.includes(t)) MINOR_TICKS.push(t);
}

const GROUP_ORDER = ["finance", "law", "escalation", "ukraine_military", "russia", "politics"] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = (searchParams.get("lang") ?? "ru") as "ru" | "en";

  let value = 0;
  let dateStr = "";
  let segments: Array<{
    key: string;
    label: string;
    labelRu: string;
    contribution: number;
    color: string;
  }> = [];

  try {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    const res = await fetch(`${baseUrl}/api/status`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      value = data.aggregate?.totalProbability ?? 0;

      if (data.calcDate) {
        dateStr = new Date(data.calcDate).toLocaleDateString(
          lang === "ru" ? "ru-RU" : "en-US", 
          { day: "numeric", month: "long", year: "numeric" }
        );
      }

      const markers: any[] = data.markers ?? [];
      const groups: any[] = data.groups ?? [];
      const map: Record<string, any[]> = {};
      for (const m of markers) (map[m.group] ??= []).push(m);

      const rows = GROUP_ORDER.map((key) => {
        const list = map[key] ?? [];
        const weight = list.reduce((sum: number, m: any) => sum + m.weight, 0);
        const wp = list.reduce((sum: number, m: any) => sum + m.weight * m.probability, 0);
        const avg = weight > 0 ? wp / weight : 0;
        const meta = groups.find((g: any) => g.key === key);
        return { key, label: meta?.label ?? key, labelRu: meta?.labelRu ?? key, avg, weight, count: list.length };
      }).filter((g) => g.count > 0);

      const totalWeight = rows.reduce((sum, g) => sum + g.weight, 0);
      for (const r of rows) r.contribution = totalWeight > 0 ? (r.weight / totalWeight) * r.avg : 0;

      segments = rows
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .map((r) => ({
          key: r.key,
          label: r.label,
          labelRu: r.labelRu,
          contribution: r.contribution,
          color: ogGroupColor(r.key),
        }));
    }
  } catch (err) {
    console.error("OG fetch error:", err);
  }

  if (segments.length === 0) {
    segments = [
      { key: "finance", label: "Int'l Finance", labelRu: "Международные финансы", contribution: 0, color: ogGroupColor("finance") },
      { key: "escalation", label: "Escalation Risk", labelRu: "Риск эскалации", contribution: 0, color: ogGroupColor("escalation") },
      { key: "ukraine_military", label: "UA Military", labelRu: "Военные маркеры UA", contribution: 0, color: ogGroupColor("ukraine_military") },
      { key: "russia", label: "Russia", labelRu: "Маркеры РФ", contribution: 0, color: ogGroupColor("russia") },
      { key: "law", label: "Legislation", labelRu: "Законодательство", contribution: 0, color: ogGroupColor("law") },
      { key: "politics", label: "Politics", labelRu: "Политика", contribution: 0, color: ogGroupColor("politics") },
    ];
  }

  const totalAbs = segments.reduce((s, x) => s + Math.abs(x.contribution), 0);
  const formatted = value > 0 ? `+${value}` : `${value}`;
  const color = ogProbabilityColor(value);
  const tier = ogTierLabel(value, lang);
  const title = lang === "en" ? "Peace Index 180" : "Индекс Мира 180";
  const subtitle = lang === "en" ? "180-day peace probability" : "Вероятность мира за 180 дней";

  const needleAngle = valueToAngle(value);
  const needleLen = R - STROKE - 10;
  const needleEnd = polar(CX, CY, needleLen, needleAngle);
  const nb1 = polar(CX, CY, 8, needleAngle + 90);
  const nb2 = polar(CX, CY, 8, needleAngle - 90);

  const positiveSegments = segments.filter((s) => s.contribution > 0);
  const negativeSegments = segments.filter((s) => s.contribution < 0);
  const totalPositive = positiveSegments.reduce((s, x) => s + x.contribution, 0);
  const totalNegative = Math.abs(negativeSegments.reduce((s, x) => s + x.contribution, 0));

  const leftArcs: Array<{ start: number; end: number; color: string }> = [];
  if (totalNegative > 0) {
    let cursor = 360;
    for (const seg of negativeSegments) {
      const portion = Math.abs(seg.contribution) / totalNegative;
      const angleSpan = portion * 135;
      const end = cursor - angleSpan;
      leftArcs.push({ start: Math.max(end, 225), end: cursor, color: seg.color });
      cursor = end;
    }
  }

  const rightArcs: Array<{ start: number; end: number; color: string }> = [];
  if (totalPositive > 0) {
    let cursor = 360;
    for (const seg of positiveSegments) {
      const portion = seg.contribution / totalPositive;
      const angleSpan = portion * 135;
      const end = cursor + angleSpan;
      rightArcs.push({ start: cursor, end: Math.min(end, 495), color: seg.color });
      cursor = end;
    }
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: `linear-gradient(135deg, ${OG_COLORS.bg_dark} 0%, ${OG_COLORS.bg_card} 100%)`, color: OG_COLORS.text_primary, fontFamily: "system-ui, -apple-system, sans-serif", padding: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 14, color: OG_COLORS.text_secondary }}>{subtitle}</div>
          </div>
          <div style={{ fontSize: 14, color: OG_COLORS.text_muted }}>{dateStr}</div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 24 }}>
          <div style={{ width: 520, height: 360, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <svg width="520" height="300" viewBox="0 0 520 300">
              <path d={arcPath(CX, CY, R, 225, 495)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={STROKE} />

              {leftArcs.map((arc, i) => (
                <path key={`L${i}`} d={arcPath(CX, CY, R, arc.start, arc.end)} fill="none" stroke={arc.color} strokeWidth={STROKE} strokeLinecap="butt" />
              ))}

              {rightArcs.map((arc, i) => (
                <path key={`R${i}`} d={arcPath(CX, CY, R, arc.start, arc.end)} fill="none" stroke={arc.color} strokeWidth={STROKE} strokeLinecap="butt" />
              ))}

              {MINOR_TICKS.map((t) => {
                const a = valueToAngle(t);
                const p1 = polar(CX, CY, R + STROKE / 2 + 2, a);
                const p2 = polar(CX, CY, R + STROKE / 2 + 6, a);
                return <line key={`m${t}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />;
              })}

              {MAJOR_TICKS.map((t) => {
                const a = valueToAngle(t);
                const p1 = polar(CX, CY, R + STROKE / 2 + 2, a);
                const p2 = polar(CX, CY, R + STROKE / 2 + 14, a);
                return <line key={`M${t}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.7)" strokeWidth={2.5} />;
              })}

              <polygon points={`${nb1.x.toFixed(1)},${nb1.y.toFixed(1)} ${nb2.x.toFixed(1)},${nb2.y.toFixed(1)} ${needleEnd.x.toFixed(1)},${needleEnd.y.toFixed(1)}`} fill="#f5f5f5" />
              <circle cx={CX} cy={CY} r={10} fill="#f5f5f5" />
              <circle cx={CX} cy={CY} r={4} fill={OG_COLORS.bg_dark} />
            </svg>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -70 }}>
              <div style={{ fontSize: 64, fontWeight: 800, color, lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>{formatted}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: OG_COLORS.text_secondary, marginTop: 6 }}>{tier}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 400, paddingTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              {lang === "en" ? "Index Structure" : "Структура индекса"}
            </div>
            {segments.map((seg) => {
              const sign = seg.contribution > 0 ? "+" : "";
              const share = totalAbs > 0 ? Math.round((Math.abs(seg.contribution) / totalAbs) * 100) : 0;
              const label = lang === "en" ? seg.label : seg.labelRu;
              return (
                <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: OG_COLORS.text_secondary }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: seg.color, fontFamily: "monospace", width: 48, textAlign: "right" }}>{sign}{seg.contribution.toFixed(1)}</span>
                  <span style={{ width: 36, textAlign: "right", fontSize: 11, color: OG_COLORS.text_muted, fontFamily: "monospace" }}>{share}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${OG_COLORS.track_bg}` }}>
          <div style={{ fontSize: 12, color: OG_COLORS.text_muted }}>{lang === "en" ? "AI-powered analytics based on open data" : "AI-аналитика на основе открытых данных"}</div>
          <div style={{ fontSize: 12, color: OG_COLORS.text_url }}>peace-index-180.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
