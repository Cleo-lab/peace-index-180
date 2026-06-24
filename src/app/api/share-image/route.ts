// app/api/share-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createCanvas } from "@napi-rs/canvas";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const value = parseInt(searchParams.get("v") || "0");
  const date = searchParams.get("d") || new Date().toISOString().slice(0, 10);
  const label = searchParams.get("l") || "Стагнация";

  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext("2d");

  // Фон
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, 1200, 630);

  // Цвет по значению
  const colors: Record<string, string> = {
    war: "#dc2626",
    escalation: "#f97316", 
    stalemate: "#737373",
    peace_tendency: "#f59e0b",
    high_peace: "#10b981",
  };
  
  // Определяем цвет
  let tier = "stalemate";
  if (value <= -60) tier = "war";
  else if (value <= -20) tier = "escalation";
  else if (value < 20) tier = "stalemate";
  else if (value < 60) tier = "peace_tendency";
  else tier = "high_peace";
  
  const color = colors[tier];

  // Градиент
  const grad = ctx.createRadialGradient(600, 250, 0, 600, 250, 500);
  grad.addColorStop(0, color + "20");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 630);

  // Заголовок
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("ИНДЕКС МИРА 180", 600, 80);

  // Дата
  ctx.fillStyle = "#888888";
  ctx.font = "24px system-ui";
  ctx.fillText(
    new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    600, 120
  );

  // Значение
  ctx.fillStyle = color;
  ctx.font = "bold 180px system-ui";
  const formatted = value > 0 ? `+${value}%` : `${value}%`;
  ctx.fillText(formatted, 600, 340);

  // Подпись
  ctx.fillStyle = "#ffffff";
  ctx.font = "48px system-ui";
  ctx.fillText(label, 600, 420);

  // Линия
  ctx.strokeStyle = color + "40";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(300, 460);
  ctx.lineTo(900, 460);
  ctx.stroke();

  // Описание
  ctx.fillStyle = "#aaaaaa";
  ctx.font = "22px system-ui";
  ctx.fillText("Оценка вероятности мира в Украине за 180 дней", 600, 510);

  // URL
  ctx.fillStyle = "#666666";
  ctx.font = "20px system-ui";
  ctx.fillText("peace-index-180.vercel.app", 600, 580);

  const buffer = canvas.toBuffer("image/png");
  
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
