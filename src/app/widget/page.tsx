// app/widget/page.tsx — финальная версия
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { SpeedometerGauge } from "@/components/peace/speedometer-gauge";
import { probabilityColor, probabilityLabelRu } from "@/lib/colors";
import { ArrowUpRight, Share2, X } from "lucide-react";

interface WidgetData {
  totalProbability: number;
  summaryEn: string;
  summaryRu: string | null;
  calcDate: string;
}

export default function WidgetPage() {
  const [data, setData] = React.useState<WidgetData | null>(null);
  const [showRationale, setShowRationale] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        if (s.aggregate) {
          setData({
            totalProbability: s.aggregate.totalProbability,
            summaryEn: s.aggregate.summaryEn,
            summaryRu: s.aggregate.summaryRu,
            calcDate: s.calcDate,
          });
        }
      });
  }, []);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  const color = probabilityColor(data.totalProbability);
  const formatted =
    data.totalProbability > 0
      ? `+${data.totalProbability}%`
      : `${data.totalProbability}%`;

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
      {/* Спидометр — компактный */}
      <div className="w-full max-w-[280px]">
        <SpeedometerGauge
          value={data.totalProbability}
          segments={[]}
          mode="circular"
          className="scale-75"
        />
      </div>

      {/* Значение */}
      <div className="mt-2 text-center">
        <div className="text-5xl font-bold tabular-nums" style={{ color }}>
          {formatted}
        </div>
        <div className="mt-1 text-sm text-white/60">
          {probabilityLabelRu(data.totalProbability)}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          {new Date(data.calcDate).toLocaleDateString("ru-RU")}
        </div>
      </div>

      {/* Кнопки */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setShowRationale(true)}
          className="rounded-full bg-white/10 px-5 py-2.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          Обоснование
        </button>

        <ShareButton value={data.totalProbability} calcDate={data.calcDate} />
      </div>

      {/* Модаль с обоснованием */}
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

          <h3 className="mt-8 text-lg font-semibold text-white">
            Обоснование оценки
          </h3>
          <p className="mt-4 flex-1 overflow-y-auto text-sm leading-relaxed text-white/80">
            {data.summaryRu || data.summaryEn}
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

function ShareButton({
  value,
  calcDate,
}: {
  value: number;
  calcDate: string;
}) {
  const [sharing, setSharing] = React.useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      const imageUrl = `https://peace-index-180.vercel.app/api/share-image?v=${value}&d=${calcDate}&l=${encodeURIComponent(probabilityLabelRu(value))}`;

      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "peace-index-180.png", {
        type: "image/png",
      });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Индекс Мира 180: ${value > 0 ? "+" : ""}${value}%`,
          text: `Оценка вероятности мира в Украине: ${probabilityLabelRu(value)}`,
          url: "https://peace-index-180.vercel.app/",
        });
      } else {
        // Fallback: копируем ссылку
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
