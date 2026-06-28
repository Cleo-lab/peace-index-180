"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  SpeedometerGauge,
  type SegmentDef,
} from "@/components/peace/speedometer-gauge";
import { useLanguage } from "@/components/peace/language-context";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  CalendarDays,
  Database,
  Clock,
  AlertTriangle,
  Shield,
  Minus,
} from "lucide-react";
import { probabilityColor, probabilityTier } from "@/lib/colors";

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
  segments: SegmentDef[];
}

function probabilityLabel(value: number, lang: string): string {
  if (value <= -60) return lang === "en" ? "War" : "Война";
  if (value <= -30) return lang === "en" ? "Escalation" : "Эскалация";
  if (value <= -10) return lang === "en" ? "Tension" : "Напряжение";
  if (value <= 10) return lang === "en" ? "Stagnation" : "Стагнация";
  if (value <= 30) return lang === "en" ? "De-escalation" : "Деэскалация";
  if (value <= 60) return lang === "en" ? "Negotiations" : "Переговоры";
  return lang === "en" ? "Peace" : "Мир";
}
/// Иконка для текущего тира
function TierIcon({ p }: { p: number }) {
  const tier = probabilityTier(p);
  if (tier === "war" || tier === "escalation") {
    return <AlertTriangle className="h-4 w-4" />;
  }
  if (tier === "high_peace" || tier === "peace_tendency") {
    return <Shield className="h-4 w-4" />;
  }
  return <Minus className="h-4 w-4" />;
}

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
  const { lang, tx } = useLanguage();
  const color = probabilityColor(totalProbability);
  const tier = probabilityTier(totalProbability);
  const running = job?.running ?? false;
  const progress = job?.progress ?? null;
  const pct =
    progress && progress.total > 0
      ? Math.round(((progress.idx + (progress.phase === "done" ? 1 : 0)) / progress.total) * 100)
      : 0;

  const displaySummary = lang === "ru" && summaryRu ? summaryRu : summaryEn;
  const summaryLabel = lang === "ru" && summaryRu ? tx("summaryLabelRu") : tx("summaryLabelEn");

  const formattedScore = totalProbability > 0 ? `+${totalProbability}` : `${totalProbability}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card"
    >
      {/* градиентный фон */}
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
        {/* Левая часть — спидометр */}
        <div className="flex flex-col items-center justify-center">
          <SpeedometerGauge value={totalProbability} segments={segments} />
        </div>

        {/* Правая часть */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color }}
            >
              {probabilityLabel(totalProbability, lang)}
            </span>
          </div>

          <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            {formattedScore}{" "}
            <span className="text-base font-medium text-muted-foreground">
              {tx("heroSubtitle")}
            </span>
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            {tx("heroDescription")}
          </p>

          {/* Summary */}
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/50 p-4 backdrop-blur-sm">
            <div className="mb-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {summaryLabel}
              </span>
            </div>
            <p className="text-justify text-sm leading-relaxed text-foreground">
              {displaySummary}
            </p>
          </div>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {calcDate && (
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDays className="h-3 w-3" />
                {new Date(calcDate).toLocaleDateString(
                  lang === "ru" ? "ru-RU" : "en-US",
                  { day: "numeric", month: "long", year: "numeric" }
                )}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Database className="h-3 w-3" />
              {markerCount}/{totalMarkers} {tx("markersCount")}
            </Badge>
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Clock className="h-3 w-3" />
              {tx("horizon")}
            </Badge>
          </div>

          {/* Прогресс пересчёта */}
          {running && progress && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <RefreshCw className="h-3 w-3 animate-spin" style={{ color }} />
                  {progress.phase === "analyzing" && tx("phaseAnalyzing")}
                  {progress.phase === "aggregating" && tx("phaseAggregating")}
                  {progress.phase === "done" && tx("phaseDone")}
                  {progress.phase === "error" && tx("phaseError")}
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
