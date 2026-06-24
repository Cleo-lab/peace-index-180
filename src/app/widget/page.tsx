// app/widget/page.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { SpeedometerGauge } from "@/components/peace/speedometer-gauge";
import { probabilityColor, probabilityLabelRu } from "@/lib/colors";
import { ArrowUpRight, Share2 } from "lucide-react";

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
      .then(r => r.json())
      .then(s => s.aggregate && setData({
        totalProbability: s.aggregate.totalProbability,
        summaryEn: s.aggregate.summaryEn,
        summaryRu: s.aggregate.summaryRu,
        calcDate: s.calcDate,
      }));
  }, []);

  if (!data) return <WidgetSkeleton />;

  const color = probabilityColor(data.totalProbability);
  const formatted = data.totalProbability > 0 
    ? `+${data.totalProbability}%` 
    : `${data.totalProbability}%`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6">
      {/* Спидометр */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-[340px]"
      >
        <SpeedometerGauge 
          value={data.totalProbability} 
          segments={[]} 
          mode="circular"
          className="scale-90"
        />
      </motion.div>

      {/* Оценка */}
      <div className="mt-2 text-center">
        <div 
          className="text-4xl font-bold tabular-nums"
          style={{ color }}
        >
          {formatted}
        </div>
        <div className="mt-1 text-sm text-white/60">
          {probabilityLabelRu(data.totalProbability)}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          {new Date(data.calcDate).toLocaleDateString("ru-RU")}
        </div>
      </div>

      {/* Кнопка Обоснование */}
      <button
        onClick={() => setShowRationale(true)}
        className="mt-6 rounded-full bg-white/10 px-6 py-2.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
      >
        Обоснование
      </button>

      {/* Модаль с обоснованием */}
      {showRationale && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-black/95 p-6 pt-12"
        >
          <button 
            onClick={() => setShowRationale(false)}
            className="absolute right-4 top-4 text-white/60"
          >
            ✕
          </button>
          
          <h3 className="text-lg font-semibold text-white">Обоснование оценки</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            {data.summaryRu || data.summaryEn}
          </p>
          
          <a
            href="https://peace-index-180.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 text-sm font-medium text-white"
          >
            Детальнее
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </motion.div>
      )}

      {/* Кнопка Поделиться (внизу экрана) */}
      <ShareButton value={data.totalProbability} calcDate={data.calcDate} />
    </div>
  );
}

function ShareButton({ value, calcDate }: { value: number; calcDate: string }) {
  const [sharing, setSharing] = React.useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      // Генерируем изображение через html2canvas или серверный эндпоинт
      const canvas = await generateWidgetImage(value, calcDate);
      const blob = await new Promise<Blob>((resolve) => 
        canvas.toBlob(b => resolve(b!), "image/png")
      );
      
      const file = new File([blob], "peace-index-180.png", { type: "image/png" });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Индекс Мира 180: ${value > 0 ? "+" : ""}${value}%`,
          text: `Оценка вероятности мира в Украине за 180 дней: ${probabilityLabelRu(value)}`,
          url: "https://peace-index-180.vercel.app/",
        });
      } else {
        // Fallback: скачать изображение
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `peace-index-180-${calcDate}.png`;
        a.click();
        URL.revokeObjectURL(url);
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
      className="mt-4 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10"
    >
      <Share2 className="h-4 w-4" />
      {sharing ? "Создание..." : "Поделиться"}
    </button>
  );
}

// Заглушка загрузки
function WidgetSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-32 w-32 animate-pulse rounded-full bg-white/10" />
    </div>
  );
}

// Генерация изображения виджета
async function generateWidgetImage(value: number, calcDate: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;
  
  const color = probabilityColor(value);
  
  // Фон
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 1080, 1080);
  
  // Градиентное свечение
  const gradient = ctx.createRadialGradient(540, 400, 0, 540, 400, 500);
  gradient.addColorStop(0, color.replace("oklch", "color").replace(")", " / 0.15)"));
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);
  
  // Заголовок
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("ИНДЕКС МИРА 180", 540, 120);
  
  // Дата
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "28px system-ui";
  ctx.fillText(
    new Date(calcDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    540, 170
  );
  
  // Большое число
  ctx.fillStyle = color;
  ctx.font = "bold 200px system-ui";
  const formatted = value > 0 ? `+${value}%` : `${value}%`;
  ctx.fillText(formatted, 540, 520);
  
  // Подпись
  ctx.fillStyle = "#ffffff";
  ctx.font = "48px system-ui";
  ctx.fillText(probabilityLabelRu(value), 540, 620);
  
  // Шкала (упрощённая)
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(540, 520, 320, Math.PI, 0);
  ctx.stroke();
  
  // Стрелка (упрощённая)
  const angle = Math.PI + ((value + 100) / 200) * Math.PI;
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(540, 520);
  ctx.lineTo(540 + Math.cos(angle) * 280, 520 + Math.sin(angle) * 280);
  ctx.stroke();
  
  // URL внизу
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "32px system-ui";
  ctx.fillText("peace-index-180.vercel.app", 540, 980);
  
  return canvas;
}
