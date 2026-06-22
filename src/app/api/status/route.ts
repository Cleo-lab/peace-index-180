import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getJobState } from "@/lib/job";
import { MARKER_MAP, GROUP_META, MARKERS } from "@/lib/markers";
import { startOfTodayUTC } from "@/lib/analyzer";

export const dynamic = "force-dynamic";

/// GET /api/status — текущее состояние: прогресс job + последние оценки.
export async function GET() {
  const job = getJobState();

  // Берём последнюю дату расчёта (самая свежая Aggregate)
  let calcDate: Date | null = null;
  const latestAgg = await db.aggregate.findFirst({
    orderBy: { calcDate: "desc" },
  });
  if (latestAgg) {
    calcDate = latestAgg.calcDate;
  } else {
    // Если агрегата ещё нет, но есть marker_scores — берём их дату
    const latestScore = await db.markerScore.findFirst({
      orderBy: { calcDate: "desc" },
    });
    calcDate = latestScore?.calcDate ?? null;
  }

  let aggregate: {
    totalProbability: number;
    summaryEn: string;
    summaryRu: string | null;
    markerCount: number;
  } | null = null;

  let markers: Array<{
    markerId: string;
    code: string;
    name: string;
    nameRu: string;
    group: string;
    groupLabelRu: string;
    weight: number;
    probability: number;
    trend: string;
    confidence: string;
    rationaleEn: string;
    rationaleRu: string | null;
    keyFacts: { fact: string; url: string }[];
  }> = [];

  if (calcDate) {
    const agg = await db.aggregate.findUnique({ where: { calcDate } });
    if (agg) {
      aggregate = {
        totalProbability: agg.totalProbability,
        summaryEn: agg.summaryEn,
        summaryRu: agg.summaryRu,
        markerCount: agg.markerCount,
      };
    }

    const scores = await db.markerScore.findMany({
      where: { calcDate },
      orderBy: { markerId: "asc" },
    });

    markers = scores.map((s) => {
      const def = MARKER_MAP[s.markerId];
      let keyFacts: { fact: string; url: string }[] = [];
      try {
        keyFacts = JSON.parse(s.keyFactsJson) as { fact: string; url: string }[];
      } catch {
        keyFacts = [];
      }
      return {
        markerId: s.markerId,
        code: def?.code ?? s.markerId,
        name: def?.name ?? s.markerId,
        nameRu: def?.nameRu ?? s.markerId,
        group: def?.group ?? "politics",
        groupLabelRu: def ? GROUP_META[def.group].labelRu : "—",
        weight: s.weight,
        probability: s.probability,
        trend: s.trend,
        confidence: s.confidence,
        rationaleEn: s.rationaleEn,
        rationaleRu: s.rationaleRu,
        keyFacts,
      };
    });
  }

  const elapsedMs =
    job.startedAt != null
      ? (job.finishedAt ?? Date.now()) - job.startedAt
      : null;

  return NextResponse.json({
    job: {
      running: job.running,
      progress: job.progress,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      elapsedMs,
      lastError: job.lastError,
      lastRunDate: job.lastRunDate ?? calcDate,
    },
    calcDate,
    today: startOfTodayUTC(),
    totalMarkers: MARKERS.length,
    aggregate,
    markers,
    groups: Object.entries(GROUP_META).map(([key, meta]) => ({
      key,
      labelRu: meta.labelRu,
      label: meta.label,
      tier: meta.weightTier,
    })),
  });
}
