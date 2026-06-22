"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface JobView {
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

interface RunPanelProps {
  job: JobView | null;
  totalMarkers: number;
  onTriggered: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  analyzing: "ИИ-анализ маркеров (с Google Search)",
  aggregating: "Агрегация индекса",
  done: "Готово",
  error: "Ошибка",
};

export function RunPanel({ job, totalMarkers, onTriggered }: RunPanelProps) {
  const [triggering, setTriggering] = React.useState(false);

  const running = job?.running ?? false;
  const progress = job?.progress ?? null;
  const pct =
    progress && progress.total > 0
      ? Math.round(((progress.idx + (progress.phase === "done" ? 1 : 0)) / progress.total) * 100)
      : 0;

  async function trigger() {
    setTriggering(true);
    try {
      const res = await fetch("/api/recalculate", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.reason === "already-running") {
          toast.info("Пересчёт уже выполняется");
        } else {
          throw new Error(data.reason || "failed");
        }
      } else {
        toast.success("Пересчёт запущен в фоне");
        onTriggered();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Не удалось запустить пересчёт: " + msg);
    } finally {
      setTriggering(false);
    }
  }

  const elapsed = job?.elapsedMs ?? 0;
  const elapsedSec = Math.round(elapsed / 1000);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Пересчёт индекса</h3>
          <p className="text-xs text-muted-foreground">
            ИИ-анализ {totalMarkers} маркеров с Google Search → агрегация.
            Обычно занимает 2–3 минуты.
          </p>
        </div>
        <Button onClick={trigger} disabled={running || triggering} className="gap-2">
          {running || triggering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? "Идёт пересчёт…" : "Запустить пересчёт"}
        </Button>
      </div>

      {running && progress && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              {PHASE_LABEL[progress.phase] ?? progress.phase}
            </span>
            <span className="text-muted-foreground">
              {progress.idx}/{progress.total} · {progress.current}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      )}

      {!running && job?.finishedAt && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {job.lastError ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-rose-600 dark:text-rose-400">
                Ошибка: {job.lastError}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-muted-foreground">
                Последний пересчёт завершён
              </span>
              {elapsedSec > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  за {elapsedSec}с
                </Badge>
              )}
            </>
          )}
        </div>
      )}

      {!running && job?.lastRunDate && !job?.finishedAt && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          Последний расчёт: {new Date(job.lastRunDate).toLocaleDateString("ru-RU")}
        </div>
      )}
    </Card>
  );
}
