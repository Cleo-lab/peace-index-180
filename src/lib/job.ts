import { runFullAnalysis, translateToRussian, type RunProgress } from "@/lib/analyzer";
import { db } from "@/lib/db";
import { startOfTodayUTC } from "@/lib/analyzer";
import { MARKERS } from "@/lib/markers";

/// In-memory состояние фонового job пересчёта.
/// Достаточно для single-instance sandbox-окружения.
interface JobState {
  running: boolean;
  progress: RunProgress | null;
  startedAt: number | null;
  finishedAt: number | null;
  lastError: string | null;
  lastRunDate: Date | null;
}

let state: JobState = {
  running: false,
  progress: null,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  lastRunDate: null,
};

export function getJobState(): Readonly<JobState> {
  return state;
}

/// Запускает полный пересчёт в фоне (не блокирует HTTP-ответ).
/// Маркеры обрабатываются по приоритету: сначала высоковесные (finance, law, escalation).
export function startRecalculation(): { started: boolean; reason?: string } {
  if (state.running) {
    return { started: false, reason: "already-running" };
  }

  const totalMarkers = MARKERS.length;

  state = {
    running: true,
    progress: { phase: "analyzing", current: "Starting…", idx: 0, total: totalMarkers },
    startedAt: Date.now(),
    finishedAt: null,
    lastError: null,
    lastRunDate: state.lastRunDate,
  };

  // Запускаем без await — фон
  runFullAnalysis((p) => {
    state.progress = p;
  })
    .then(() => {
      state.lastRunDate = startOfTodayUTC();
      state.finishedAt = Date.now();
    })
    .catch((err) => {
      console.error("[job] recalculation failed:", err);
      state.lastError = err?.message ?? String(err);
      state.finishedAt = Date.now();
    })
    .finally(() => {
      state.running = false;
    });

  return { started: true };
}

/// Кэш переводов rationale/summary по (calcDate, markerId) и calcDate.
const translationCache = new Map<string, string>();

/// Перевод rationale маркера на русский (с кэшем в БД).
export async function translateMarkerRationale(
  calcDate: Date,
  markerId: string,
): Promise<string> {
  const key = `m:${calcDate.toISOString()}:${markerId}`;
  const cached = translationCache.get(key);
  if (cached) return cached;

  const score = await db.markerScore.findUnique({
    where: { calcDate_markerId: { calcDate, markerId } },
  });
  if (!score) throw new Error("score not found");

  if (score.rationaleRu) {
    translationCache.set(key, score.rationaleRu);
    return score.rationaleRu;
  }

  const ru = await translateToRussian(score.rationaleEn);
  await db.markerScore.update({
    where: { calcDate_markerId: { calcDate, markerId } },
    data: { rationaleRu: ru },
  });
  translationCache.set(key, ru);
  return ru;
}

/// Перевод сводного summary на русский (с кэшем в БД).
export async function translateAggregateSummary(
  calcDate: Date,
): Promise<string> {
  const key = `a:${calcDate.toISOString()}`;
  const cached = translationCache.get(key);
  if (cached) return cached;

  const agg = await db.aggregate.findUnique({ where: { calcDate } });
  if (!agg) throw new Error("aggregate not found");

  if (agg.summaryRu) {
    translationCache.set(key, agg.summaryRu);
    return agg.summaryRu;
  }

  const ru = await translateToRussian(agg.summaryEn);
  await db.aggregate.update({
    where: { calcDate },
    data: { summaryRu: ru },
  });
  translationCache.set(key, ru);
  return ru;
}
