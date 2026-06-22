"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  SpeedometerGauge,
  type SegmentDef,
} from "@/components/peace/speedometer-gauge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Languages,
  Loader2,
  CalendarDays,
  Database,
  Clock,
  Sparkles,
} from "lucide-react";
import { probabilityColor } from "@/lib/colors";
import { toast } from "sonner";

export interface HeroJobView {
  running: boolean;
  progress: {
    phase: "analyzing" | "aggregating" | "done" | "error";
    current: string;
    idx: number;
    total: number;
  } | null;
  startedAt: number | null;
  finishedAt: number | null;
  elapsedMs: number | null;
  lastError: string | null;
  lastRunDate: string | null;
}

interface HeroSectionProps {
  totalProbability: number;
  summaryEn: string;
  summaryRu: string | null;
  calcDate: string | null;
  markerCount: number;
  totalMarkers: number;
  job: HeroJobView | null;
  onRefresh: () => void;
  refreshTick: number;
  /// Сегменты для спидометра (вклады групп).
  segments: SegmentDef[];
}

const PHASE_LABEL: Record<string, string> = {
  analyzing: "ИИ-анализ маркеров (с Google Search)",
  aggregating: "Агрегация индекса",
  done: "Готово",
  error: "Ошибка",
};

export function HeroSection({
  totalProbability,
  summaryEn,
  summaryRu,
  calcDate,
  markerCount,
  totalMarkers,
  job,
  onRefresh,
  refreshTick,
  segments,
}: HeroSectionProps) {
  const color = probabilityColor(totalProbability);
  const running = job?.running ?? false;
  const progress = job?.progress ?? null;
  const pct =
    progress && progress.total > 0
      ? Math.round(((progress.idx + (progress.phase === "done" ? 1 : 0)) / progress.total) * 100)
      : 0;

  const [translating, setTranslating] = React.useState(false);
  const [ruText, setRuText] = React.useState<string | null>(summaryRu);
  const [showRu, setShowRu] = React.useState<boolean>(!!summaryRu);

  React.useEffect(() => {
    setRuText(summaryRu);
    setShowRu(!!summaryRu);
  }, [summaryRu, totalProbability, calcDate]);

  async function translate() {
    if (ruText) {
      setShowRu((s) => !s);
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "aggregate", calcDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "failed");
      setRuText(data.text);
      setShowRu(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Не удалось перевести: " + msg);
    } finally {
      setTranslating(false);
    }
  }

  const lastRunDate = job?.lastRunDate ?? calcDate;
  const elapsedSec = job?.elapsedMs ? Math.round(job.elapsedMs / 1000) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card"
    >
      {/* Градиентный фон, окрашенный вероятностью */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 30%, color-mix(in oklch, ${color} 18%, transparent), transparent 60%),
            radial-gradient(ellipse 60% 50% at 90% 80%, color-mix(in oklch, ${color} 10%, transparent), transparent 55%)
          `,
        }}
        aria-hidden
      />

      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:gap-8 lg:p-10">
        {/* Левая часть — спидометр с сегментами-вкладами */}
        <div className="flex items-center justify-center">
          <SpeedometerGauge value={totalProbability} segments={segments} />
        </div>

        {/* Правая часть — summary + meta + actions */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Итоговая оценка аналитика
            </span>
          </div>

          <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            {totalProbability}%{" "}
            <span className="text-base font-medium text-muted-foreground">
              — вероятность мира за 180 дней
            </span>
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Дуга спидометра окрашена по вкладам групп маркеров. Каждый цвет —
            своя группа, длина сегмента = её вклад в общую оценку.
          </p>

          {/* Summary */}
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/50 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {showRu && ruText ? "Обоснование · RU" : "Обоснование · EN"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={translate}
                disabled={translating}
              >
                {translating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Languages className="h-3.5 w-3.5" />
                )}
                {ruText ? (showRu ? "Показать EN" : "Показать RU") : "Перевести на RU"}
              </Button>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {showRu && ruText ? ruText : summaryEn}
            </p>
          </div>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {calcDate && (
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDays className="h-3 w-3" />
                {new Date(calcDate).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Database className="h-3 w-3" />
              {markerCount}/{totalMarkers} маркеров
            </Badge>
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Clock className="h-3 w-3" />
              горизонт 180 дней
            </Badge>
          </div>

          {/* Refresh action */}
          <div className="mt-5 flex items-center gap-3">
            <Button
              onClick={onRefresh}
              disabled={running}
              className="gap-2 rounded-full"
              style={running ? undefined : { backgroundColor: color, color: "white" }}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {running ? "Пересчёт…" : "Обновить данные"}
            </Button>
            {!running && lastRunDate && (
              <span className="text-xs text-muted-foreground">
                {job?.lastError ? (
                  <span className="text-rose-500">ошибка последнего пересчёта</span>
                ) : (
                  <>
                    обновлено{" "}
                    {new Date(lastRunDate).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                    })}
                    {elapsedSec ? ` · ${elapsedSec}с` : ""}
                  </>
                )}
              </span>
            )}
          </div>

          {/* Прогресс пересчёта */}
          {running && progress && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Loader2 className="h-3 w-3 animate-spin" style={{ color }} />
                  {PHASE_LABEL[progress.phase] ?? progress.phase}
                </span>
                <span className="text-muted-foreground">
                  {progress.current} · {progress.idx}/{progress.total}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
