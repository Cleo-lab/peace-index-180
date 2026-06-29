// app/widget/page.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { SpeedometerGauge, type SegmentDef } from "@/components/peace/speedometer-gauge";
import { LanguageProvider, useLanguage } from "@/components/peace/language-context";
import { LanguageToggle } from "@/components/peace/language-toggle";
import { probabilityLabelRu } from "@/lib/colors";
import { ArrowUpRight, Share2, X, Camera } from "lucide-react";
import Head from "next/head";

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
  const [sharing, setSharing] = React.useState(false);
  const { lang, tx, setLang } = useLanguage();

  // Ref для скриншота — спидометр + легенда
  const captureRef = React.useRef<HTMLDivElement>(null);

  // Синхронизируем язык из URL при загрузке
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang === "en" || urlLang === "ru") {
      setLang(urlLang);
    }
  }, [setLang]);

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
            labelEn: meta?.label,
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
          labelEn: r.labelEn,
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

  // ===== СКРИНШОТ + ШАРИНГ =====
  async function handleShare() {
    if (!captureRef.current || !data) return;

    setSharing(true);
    try {
      // Делаем скриншот
      const dataUrl = await toPng(captureRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#000000",
      });

      // Конвертируем в blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `peace-index-${data.calcDate}.png`, { type: "image/png" });

      const shareUrl = `https://peace-index-180.vercel.app/widget?lang=${lang}`;
      const label = probabilityLabelRu(data.totalProbability);
      const formatted = data.totalProbability > 0 ? `+${data.totalProbability}` : `${data.totalProbability}`;
      const shareText = `${tx("appTitle")}: ${formatted}% — ${label}`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: tx("appTitle"),
          text: shareText,
          url: shareUrl,
          files: [file],
        });
      } else if (navigator.share) {
        // Fallback: без файла, но с URL
        await navigator.share({
          title: tx("appTitle"),
          text: `${shareText}
${shareUrl}`,
          url: shareUrl,
        });
      } else {
        // Fallback: копируем в буфер обмена
        await navigator.clipboard.writeText(`${shareText}
${shareUrl}`);
        alert(tx("widgetCopied"));
      }
    } catch (err) {
      console.error("Share failed:", err);
      // Если шаринг отменён пользователем — не показываем ошибку
      if (err instanceof Error && err.name !== "AbortError") {
        alert("Failed to share. Please try again.");
      }
    } finally {
      setSharing(false);
    }
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  const rationaleText = lang === "ru" && data.summaryRu ? data.summaryRu : data.summaryEn;
  const formatted = data.totalProbability > 0 ? `+${data.totalProbability}` : `${data.totalProbability}`;
  const shareUrl = `https://peace-index-180.vercel.app/widget?lang=${lang}`;

  // OG-мета для ссылки (когда шарят URL, а не файл)
  const ogImageUrl = `https://peace-index-180.vercel.app/api/og?lang=${lang}`;

  return (
    <>
      <Head>
        <title>{tx("appTitle")}: {formatted}%</title>
        <meta property="og:title" content={`${tx("appTitle")}: ${formatted}%`} />
        <meta property="og:description" content={rationaleText.slice(0, 160)} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>

      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">

        {/* ===== ОБЛАСТЬ СКРИНШОТА ===== */}
                <div 
          ref={captureRef} 
          className="w-full max-w-[300px] rounded-3xl overflow-visible"
          style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)" }}
        >
          <div className="px-5 pb-5 pt-10">
            <SpeedometerGauge
              value={data.totalProbability}
              segments={data.segments}
              dark={true}
            />

          {/* Дата под спидометром */}
          <div className="mt-4 text-center text-xs text-white/40">
            {new Date(data.calcDate).toLocaleDateString(
              lang === "ru" ? "ru-RU" : "en-US",
              { day: "numeric", month: "long", year: "numeric" }
            )}
          </div>

                      {/* URL внизу */}
            <div className="mt-2 text-center text-[10px] text-white/20">
              peace-index-180.vercel.app
            </div>
          </div>
        </div>

        {/* ===== КНОПКИ УПРАВЛЕНИЯ (не входят в скриншот) ===== */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <LanguageToggle variant="dark" />

          <button
            onClick={() => setShowRationale(true)}
            className="rounded-full bg-white/10 px-5 py-2.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            {tx("widgetRationale")}
          </button>

          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-2 rounded-full bg-emerald-600/20 px-5 py-2.5 text-sm text-emerald-400 transition hover:bg-emerald-600/30 disabled:opacity-50"
          >
            {sharing ? (
              <Camera className="h-4 w-4 animate-pulse" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {sharing ? "..." : tx("widgetShare")}
          </button>
        </div>

        {/* ===== МОДАЛЬНОЕ ОКНО С ОБОСНОВАНИЕМ ===== */}
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
              {tx("widgetRationaleTitle")}
            </h3>
            <p className="mt-4 flex-1 overflow-y-auto text-justify text-sm leading-relaxed text-white/80">
              {rationaleText}
            </p>
            <a
              href="https://peace-index-180.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 text-sm font-medium text-white"
            >
              {tx("widgetDetails")}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </motion.div>
        )}
      </div>
    </>
  );
}

