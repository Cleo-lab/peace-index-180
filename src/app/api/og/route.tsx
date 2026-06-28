// app/api/og/route.tsx
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const value = Number(searchParams.get("v") || "0");
  const date = searchParams.get("d") || "";
  const label = searchParams.get("l") || "";
  const lang = searchParams.get("lang") || "ru";

  // Цвета по значению
  const getColor = (v: number) => {
    if (v <= -60) return "#dc2626"; // red
    if (v <= -20) return "#f97316"; // orange
    if (v < 20) return "#6b7280"; // gray
    if (v < 60) return "#f59e0b"; // amber
    return "#10b981"; // emerald
  };

  const color = getColor(value);
  const formatted = value > 0 ? `+${value}` : `${value}`;

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
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Логотип / заголовок */}
        <div style={{ fontSize: 24, color: "#94a3b8", marginBottom: 20 }}>
          {lang === "en" ? "Peace Index 180" : "Индекс Мира 180"}
        </div>

        {/* Спидометр-заглушка (дуга) */}
        <div
          style={{
            width: 280,
            height: 140,
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <svg width="280" height="140" viewBox="0 0 280 140">
            <path
              d="M 20 140 A 120 120 0 0 1 260 140"
              fill="none"
              stroke="#334155"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <path
              d="M 20 140 A 120 120 0 0 1 260 140"
              fill="none"
              stroke={color}
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${((value + 100) / 200) * 377} 377`}
            />
            {/* Стрелка */}
            <line
              x1="140"
              y1="140"
              x2={140 + 100 * Math.cos(Math.PI - ((value + 100) / 200) * Math.PI)}
              y2={140 - 100 * Math.sin(Math.PI - ((value + 100) / 200) * Math.PI)}
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="140" cy="140" r="8" fill="white" />
          </svg>
        </div>

        {/* Значение */}
        <div style={{ fontSize: 64, fontWeight: 700, color, marginTop: 10 }}>
          {formatted}
        </div>
        <div style={{ fontSize: 20, color: "#94a3b8", marginTop: 4 }}>
          {label}
        </div>

        {/* Дата */}
        <div style={{ fontSize: 14, color: "#64748b", marginTop: 20 }}>
          {date}
        </div>

        {/* URL */}
        <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>
          peace-index-180.vercel.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
