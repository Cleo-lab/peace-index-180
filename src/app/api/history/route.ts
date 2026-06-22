import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/// GET /api/history?days=90 — история total_probability за N дней.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "90") || 90, 7), 365);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await db.aggregate.findMany({
    where: { calcDate: { gte: since } },
    orderBy: { calcDate: "asc" },
  });

  return NextResponse.json({
    days,
    points: rows.map((r) => ({
      date: r.calcDate.toISOString().slice(0, 10),
      probability: r.totalProbability,
      markerCount: r.markerCount,
    })),
  });
}
