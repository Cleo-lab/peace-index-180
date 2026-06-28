"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/peace/language-context";

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

export function RunPanel({ job, totalMarkers, onTriggered }: RunPanelProps) {
  const { tx, lang } = useLanguage();
  const [triggering, setTriggering] = React.useState(false);

  const running = job?.running ?? false;
  const progress = job?.progress ?? null;
  const pct =
    progress && progress.total > 0
      ? Math.round(((progress.idx + (progress.phase === "done" ? 1 : 0)) / progress.total) * 100)
      : 0;

  const phaseLabel: Record<string, string> = {
    analyzing: tx("runPhaseAnalyzing"),
    aggregating: tx("runPhaseAggregating"),
    done: tx("runPhaseDone"),
    error: tx("runPhaseError"),
  };

  async function trigger() {
    setTriggering(true);
    try {
      const res = await fetch("/api/recalculate", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.reason === "already-running") {
          toast.info(tx("runPanelAlreadyRunning"));
        } else {
          throw new Error(data.reason || "failed");
        }
      } else {
        toast.success(tx("runPanelStarted"));
        onTriggered();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(tx("runPanelError") + ": " + msg);
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
          <h3 className="text-sm font-semibold">{tx("runPanelTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {tx("runPanelSubtitle").replace("{count}", String(totalMarkers))}
          </p>
        </div>
        <Button onClick={trigger} disabled={running || triggering} className="gap-2">
          {running || triggering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? tx("runPanelBtnRunning") : tx("runPanelBtnIdle")}
        </Button>
      </div>

      {running && progress && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              {phaseLabel[progress.phase] ?? progress.phase}
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
                {tx("runLastError")}: {job.lastError}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-muted-foreground">
                {tx("runLastDone")}
              </span>
              {elapsedSec > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  {tx("runElapsed").replace("{sec}", String(elapsedSec))}
                </Badge>
              )}
            </>
          )}
        </div>
      )}

      {!running && job?.lastRunDate && !job?.finishedAt && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          {tx("runLastCalc")}: {new Date(job.lastRunDate).toLocaleDateString(
            lang === "ru" ? "ru-RU" : "en-US"
          )}
        </div>
      )}
    </Card>
  );
}
