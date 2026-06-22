import { NextResponse } from "next/server";
import { startRecalculation } from "@/lib/job";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel: до 60s на Hobby, 300s на Pro

/// POST /api/recalculate — запускает фоновый полный пересчёт индекса.
/// На Vercel serverless фон не живёт после ответа, поэтому при деплое
/// используйте GitHub Actions cron для ежедневного пересчёта (см. .github/workflows/).
/// Этот роут работает в локальной разработке и на VPS.
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
