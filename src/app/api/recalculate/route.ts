import { NextRequest, NextResponse } from "next/server";
import { startRecalculation } from "@/lib/job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/// GET /api/recalculate?secret=CRON_SECRET — запускает пересчёт индекса.
/// Используется GitHub Actions cron для ежедневного пересчёта.
/// 
/// ВАЖНО: На Vercel serverless фоновые процессы не живут после ответа.
/// Поэтому реальный пересчёт выполняется через GitHub Actions (scripts/recalculate.ts),
/// а этот endpoint — только для ручного запуска или внешних триггеров.
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  // В production требуем секрет
  if (process.env.NODE_ENV === "production" && secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const res = startRecalculation();
  
  if (!res.started) {
    return NextResponse.json(
      { ok: false, reason: res.reason },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    started: true,
    message: "Recalculation started. Note: on Vercel serverless, the process may not complete. Use GitHub Actions for reliable daily recalculation.",
    timestamp: new Date().toISOString(),
  });
}

/// POST оставлен для обратной совместимости (ручной запуск из UI/Postman).
/// Без защиты секретом — только для локальной разработки.
export async function POST() {
  // В production блокируем POST (нет защиты)
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Use GET with secret in production" },
      { status: 403 },
    );
  }

  const res = startRecalculation();
  
  if (!res.started) {
    return NextResponse.json(
      { ok: false, reason: res.reason },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, started: true });
}
