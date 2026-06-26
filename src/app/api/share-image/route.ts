import { NextRequest, NextResponse } from "next/server";
import satori from "satori";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const value = parseInt(searchParams.get("v") || "0");
  const date = searchParams.get("d") || new Date().toISOString().slice(0, 10);
  const label = searchParams.get("l") || "Стагнация";

  let color = "#737373";
  if (value <= -60) color = "#dc2626";
  else if (value <= -20) color = "#f97316";
  else if (value < 20) color = "#737373";
  else if (value < 60) color = "#f59e0b";
  else color = "#10b981";

  const formatted = value > 0 ? `+${value}%` : `${value}%`;

  const fontData = await fetch(
    "https://github.com/rsms/inter/raw/refs/heads/main/docs/font-files/InterDisplay-Bold.woff"
  ).then((res) => res.arrayBuffer());

    const node: any = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              width: "800px",
              height: "800px",
              borderRadius: "400px",
              background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
              top: "-100px",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              color: "#ffffff",
              fontSize: "42px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              marginBottom: "16px",
            },
            children: "ИНДЕКС МИРА 180",
          },
        },
        {
          type: "div",
          props: {
            style: {
              color: "#888888",
              fontSize: "24px",
              marginBottom: "40px",
            },
            children: new Date(date).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          },
        },
        {
          type: "div",
          props: {
            style: {
              color: color,
              fontSize: "180px",
              fontWeight: 700,
              lineHeight: 1,
            },
            children: formatted,
          },
        },
        {
          type: "div",
          props: {
            style: {
              color: "#ffffff",
              fontSize: "48px",
              marginTop: "24px",
            },
            children: label,
          },
        },
        {
          type: "div",
          props: {
            style: {
              width: "600px",
              height: "4px",
              background: `${color}40`,
              marginTop: "40px",
              borderRadius: "2px",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              color: "#aaaaaa",
              fontSize: "22px",
              marginTop: "24px",
              textAlign: "center",
            },
            children: "Оценка вероятности мира в Украине за 180 дней",
          },
        },
        {
          type: "div",
          props: {
            style: {
              color: "#666666",
              fontSize: "20px",
              marginTop: "60px",
            },
            children: "peace-index-180.vercel.app",
          },
        },
      ],
    },
  };

  const svg = await satori(node, {
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
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
