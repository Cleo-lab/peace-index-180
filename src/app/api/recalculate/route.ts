import { NextRequest, NextResponse } from "next/server";
import { startRecalculation } from "@/lib/job";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel: до 60s на Hobby, 300s на Pro

/// GET /api/recalculate?secret=CRON_SECRET — запускает фоновый полный пересчёт.
/// Используется GitHub Actions cron для ежедневного пересчёта.
/// POST без секрета оставлен для обратной совместимости (ручной запуск из UI).
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  // В production требуем секрет, в dev — можно без него
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
    timestamp: new Date().toISOString(),
  });
}

/// POST оставлен для обратной совместимости (ручной запуск из админки/Postman).
/// В production рекомендуется использовать GET с секретом.
export async function POST() {
  const res = startRecalculation();
  if (!res.started) {
    return NextResponse.json(
      { ok: false, reason: res.reason },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, started: true });
}
