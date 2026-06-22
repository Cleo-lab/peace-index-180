"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { groupColor, probabilityColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { MarkerCard, type MarkerView } from "@/components/peace/marker-card";

export interface GroupRow {
  key: string;
  labelRu: string;
  avg: number;
  weight: number;
  count: number;
  contribution: number; // вклад в общую оценку (пунктов)
  markers: MarkerView[];
  calcDate: string;
}

interface GroupOverviewProps {
  groups: GroupRow[];
  openKeys: string[];
  onToggle: (key: string) => void;
}

const TIER_LABEL: Record<string, string> = {
  high: "Высокий вес",
  medium: "Средний вес",
  low: "Низкий вес",
};

export function GroupOverview({ groups, openKeys, onToggle }: GroupOverviewProps) {
  const maxWeight = Math.max(...groups.map((g) => g.weight), 1);

  return (
    <div className="space-y-2.5">
      {groups.map((g, i) => {
        const color = groupColor(g.key);
        const isOpen = openKeys.includes(g.key);
        const probColor = probabilityColor(g.avg);
        return (
          <motion.div
            key={g.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04, ease: "easeOut" }}
            className={cn(
              "relative overflow-hidden rounded-2xl border bg-card transition-all",
              isOpen
                ? "border-foreground/25 shadow-sm"
                : "border-border hover:border-foreground/20 hover:shadow-sm",
            )}
          >
            {/* Цветная левая полоса группы */}
            <div
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: color }}
              aria-hidden
            />

            <button
              onClick={() => onToggle(g.key)}
              className="flex w-full items-center gap-4 p-4 text-left sm:px-5"
              aria-expanded={isOpen}
            >
              {/* Заголовок + мета */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <p className="truncate text-sm font-semibold leading-tight">
                    {g.labelRu}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {g.count} марк. · вес {g.weight}
                  </span>
                </div>

                {/* Полоса вероятности группы */}
                <div className="mt-2 relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${g.avg}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.04, ease: "easeOut" }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ backgroundColor: probColor }}
                  />
                </div>

                {/* Полоса веса (относительная) */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(g.weight / maxWeight) * 100}%`,
                        backgroundColor: "var(--foreground)",
                        opacity: 0.22,
                      }}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {TIER_LABEL[g.weight >= 25 ? "high" : g.weight >= 12 ? "medium" : "low"]}
                  </span>
                </div>
              </div>

              {/* Вклад + вероятность + chevron */}
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div
                    className="font-mono text-lg font-bold tabular-nums sm:text-xl"
                    style={{ color: probColor }}
                  >
                    {Math.round(g.avg)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    вклад{" "}
                    <span className="font-semibold" style={{ color }}>
                      +{g.contribution.toFixed(1)}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </div>
            </button>

            {/* Раскрытые маркеры внутри */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/60 p-3 sm:px-5 sm:py-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      {g.markers.map((m) => (
                        <MarkerCard key={m.markerId} marker={m} calcDate={g.calcDate} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
