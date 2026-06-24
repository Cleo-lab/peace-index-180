import { NextRequest, NextResponse } from "next/server";
import satori from "satori";

export const runtime = "edge"; // Edge runtime — быстрее и дешевле

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const value = parseInt(searchParams.get("v") || "0");
  const date = searchParams.get("d") || new Date().toISOString().slice(0, 10);
  const label = searchParams.get("l") || "Стагнация";

  // Определяем цвет по значению
  let color = "#737373"; // stalemate (gray)
  if (value <= -60) color = "#dc2626";      // war (red)
  else if (value <= -20) color = "#f97316"; // escalation (orange)
  else if (value < 20) color = "#737373";   // stalemate
  else if (value < 60) color = "#f59e0b";   // peace tendency (amber)
  else color = "#10b981";                   // high peace (emerald)

  const formatted = value > 0 ? `+${value}%` : `${value}%`;

  // Загружаем шрифт (Inter или системный)
  const fontData = await fetch(
    "https://github.com/rsms/inter/raw/refs/heads/main/docs/font-files/InterDisplay-Bold.woff"
  ).then((res) => res.arrayBuffer());

  const svg = await satori(
    <div
      style={{
        width: "1200px",
        height: "630px",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Градиентное свечение */}
      <div
        style={{
          position: "absolute",
          width: "800px",
          height: "800px",
          borderRadius: "400px",
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
          top: "-100px",
        }}
      />

      {/* Заголовок */}
      <div
        style={{
          color: "#ffffff",
          fontSize: "42px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          marginBottom: "16px",
        }}
      >
        ИНДЕКС МИРА 180
      </div>

      {/* Дата */}
      <div
        style={{
          color: "#888888",
          fontSize: "24px",
          marginBottom: "40px",
        }}
      >
        {new Date(date).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </div>

      {/* Большое значение */}
      <div
        style={{
          color: color,
          fontSize: "180px",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {formatted}
      </div>

      {/* Подпись */}
      <div
        style={{
          color: "#ffffff",
          fontSize: "48px",
          marginTop: "24px",
        }}
      >
        {label}
      </div>

      {/* Линия */}
      <div
        style={{
          width: "600px",
          height: "4px",
          background: `${color}40`,
          marginTop: "40px",
          borderRadius: "2px",
        }}
      />

      {/* Описание */}
      <div
        style={{
          color: "#aaaaaa",
          fontSize: "22px",
          marginTop: "24px",
          textAlign: "center",
        }}
      >
        Оценка вероятности мира в Украине за 180 дней
      </div>

      {/* URL */}
      <div
        style={{
          color: "#666666",
          fontSize: "20px",
          marginTop: "60px",
        }}
      >
        peace-index-180.vercel.app
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );

  // Конвертируем SVG в PNG через @resvg/resvg-wasm (чистый WASM, без нативных модулей)
  const { Resvg } = await import("@resvg/resvg-wasm");
  
  // Инициализируем WASM один раз (кэшируется в Edge runtime)
  const wasmResponse = await fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
  const wasmArrayBuffer = await wasmResponse.arrayBuffer();
  await Resvg.init(wasmArrayBuffer);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  
  const pngBuffer = resvg.render().asPng();

  return new NextResponse(pngBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
