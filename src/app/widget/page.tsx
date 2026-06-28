// app/widget/page.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { SpeedometerGauge, type SegmentDef } from "@/components/peace/speedometer-gauge";
import { LanguageProvider, useLanguage } from "@/components/peace/language-context";
import { LanguageToggle } from "@/components/peace/language-toggle";
import { probabilityLabelRu } from "@/lib/colors";
import { ArrowUpRight, Share2, X } from "lucide-react";

const GROUP_ORDER = ["finance", "law", "escalation", "ukraine_military", "russia", "politics"] as const;

interface WidgetData {
  totalProbability: number;
  summaryEn: string;
  summaryRu: string | null;
  calcDate: string;
  segments: SegmentDef[];
}

export default function WidgetPage() {
  return (
    <LanguageProvider>
      <WidgetContent />
    </LanguageProvider>
  );
}

function WidgetContent() {
  const [data, setData] = React.useState<WidgetData | null>(null);
  const [showRationale, setShowRationale] = React.useState(false);
  const { lang } = useLanguage();

  React.useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        if (!s.aggregate) return;

        const markers = s.markers ?? [];
        const groups = s.groups ?? [];
        const calcDate = s.calcDate ?? "";

        const map: Record<string, any[]> = {};
        for (const m of markers) (map[m.group] ??= []).push(m);

        const rows = GROUP_ORDER.map((key) => {
          const list = map[key] ?? [];
          const weight = list.reduce((sum: number, m: any) => sum + m.weight, 0);
          const wp = list.reduce((sum: number, m: any) => sum + m.weight * m.probability, 0);
          const avg = weight > 0 ? wp / weight : 0;
          const meta = groups.find((g: any) => g.key === key);
          return {
            key,
            labelRu: meta?.labelRu ?? key,
            avg,
            weight,
            count: list.length,
            contribution: 0,
            markers: list,
            calcDate,
          };
        }).filter((g) => g.count > 0);

        const totalWeight = rows.reduce((sum, g) => sum + g.weight, 0);
        for (const r of rows) {
          r.contribution = totalWeight > 0 ? (r.weight / totalWeight) * r.avg : 0;
        }

        const segments: SegmentDef[] = rows.map((r) => ({
          groupKey: r.key,
          label: r.labelRu,
          contribution: r.contribution,
          avgProbability: r.avg,
        }));

        setData({
          totalProbability: s.aggregate.totalProbability,
          summaryEn: s.aggregate.summaryEn,
          summaryRu: s.aggregate.summaryRu,
          calcDate: s.calcDate,
          segments,
        });
      });
  }, []);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  const rationaleText = lang === "ru" && data.summaryRu ? data.summaryRu : data.summaryEn;

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
      <div className="w-full max-w-[320px]">
        <SpeedometerGauge
          value={data.totalProbability}
          segments={data.segments}
          dark={true}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <LanguageToggle variant="dark" />
        <button
          onClick={() => setShowRationale(true)}
          className="rounded-full bg-white/10 px-5 py-2.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          Обоснование
        </button>
        <ShareButton value={data.totalProbability} calcDate={data.calcDate} />
      </div>

      {showRationale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex flex-col bg-black/95 p-6"
        >
          <button
            onClick={() => setShowRationale(false)}
            className="absolute right-4 top-4 text-white/60"
          >
            <X className="h-6 w-6" />
          </button>
          <h3 className="mt-8 text-lg font-semibold text-white">Обоснование оценки</h3>
          <p className="mt-4 flex-1 overflow-y-auto text-sm leading-relaxed text-white/80">
            {rationaleText}
          </p>
          <a
            href="https://peace-index-180.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 text-sm font-medium text-white"
          >
            Детальнее
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </motion.div>
      )}
    </div>
  );
}

// ShareButton остаётся без изменений
function ShareButton({ value, calcDate }: { value: number; calcDate: string }) {
  const [sharing, setSharing] = React.useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      const imageUrl = `https://peace-index-180.vercel.app/api/share-image?v=${value}&d=${calcDate}&l=${encodeURIComponent(probabilityLabelRu(value))}`;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "peace-index-180.png", { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Индекс Мира 180: ${value > 0 ? "+" : ""}${value}%`,
          text: `Оценка вероятности мира в Украине: ${probabilityLabelRu(value)}`,
          url: "https://peace-index-180.vercel.app/",
        });
      } else {
        await navigator.clipboard.writeText(
          `Индекс Мира 180: ${value > 0 ? "+" : ""}${value}% — ${probabilityLabelRu(value)}\nhttps://peace-index-180.vercel.app/`
        );
        alert("Ссылка скопирована в буфер обмена!");
      }
    } catch (e) {
      console.error("Share failed:", e);
    } finally {
      setSharing(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/10"
    >
      <Share2 className="h-4 w-4" />
      {sharing ? "..." : "Поделиться"}
    </button>
  );
}
