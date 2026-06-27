"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Languages,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  confidenceColor,
  confidenceLabelRu,
  probabilityColor,
  probabilityLabelRu,
  trendColor,
  trendLabelRu,
} from "@/lib/colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface MarkerView {
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
}

interface MarkerCardProps {
  marker: MarkerView;
  calcDate: string; // ISO
}

export function MarkerCard({ marker, calcDate }: MarkerCardProps) {
  const [open, setOpen] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [ruText, setRuText] = React.useState<string | null>(marker.rationaleRu);

  React.useEffect(() => {
    setRuText(marker.rationaleRu);
  }, [marker.rationaleRu, marker.markerId]);

  const pColor = probabilityColor(marker.probability);
  const t = trendLabelRu(marker.trend);
  const confColor = confidenceColor(marker.confidence);

  async function handleTranslate() {
    if (ruText) {
      // Уже есть — просто переключаем видимость
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "marker",
          markerId: marker.markerId,
          calcDate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "translate-failed");
      setRuText(data.text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Не удалось перевести: " + msg);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-stretch">
        {/* Цветная полоса вероятности */}
        <div
          className="w-1.5 shrink-0"
          style={{ backgroundColor: pColor }}
          aria-hidden
        />

        <div className="flex-1 p-4 sm:p-5">
          {/* Заголовок */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  {marker.code}
                </Badge>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  вес {marker.weight}
                </span>
              </div>
              <h4 className="mt-1 truncate text-sm font-semibold leading-tight">
                {marker.nameRu}
              </h4>
              <p className="truncate text-xs text-muted-foreground">{marker.name}</p>
            </div>

            {/* Вероятность */}
            <div className="flex flex-col items-end">
              <span
                className="font-mono text-2xl font-bold tabular-nums"
                style={{ color: pColor }}
              >
                {marker.probability}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {probabilityLabelRu(marker.probability)}
              </span>
            </div>
          </div>

          {/* Тренд + уверенность */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="gap-1 text-[11px]"
              style={{ color: trendColor(marker.trend) }}
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </Badge>
            <Badge
              variant="secondary"
              className="gap-1 text-[11px]"
              style={{ color: confColor }}
            >
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Уверенность: {confidenceLabelRu(marker.confidence)}
            </Badge>
          </div>

          {/* Раскрывающееся обоснование */}
          <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Обоснование {ruText ? "(EN/RU)" : "(EN)"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <div className="rounded-md border border-border/70 bg-muted/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  English
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {marker.rationaleEn}
                </p>
              </div>

              {ruText ? (
                <div className="rounded-md border border-border/70 bg-muted/40 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Русский
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {ruText}
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleTranslate}
                  disabled={translating}
                >
                  {translating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Languages className="h-3.5 w-3.5" />
                  )}
                  Перевести на русский
                </Button>
              )}

              {/* Key facts с антигаллюцинационными ссылками */}
              {marker.keyFacts.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Ключевые факты (с источниками)
                  </p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {marker.keyFacts.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        <span className="flex-1">
                          {f.fact}{" "}
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 align-baseline text-[11px] font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
                          >
                            источник
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!marker.keyFacts.length && (
                <p className="text-xs italic text-muted-foreground">
                  Модель не предоставила верифицируемых фактов с URL из входных данных.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </Card>
  );
}
