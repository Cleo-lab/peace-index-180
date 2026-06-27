"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Target, Scale, Eye, Database, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MethodologyModalProps {
  open: boolean;
  onClose: () => void;
}

const BLOCKS = [
  {
    icon: Target,
    title: "Горизонт прогноза",
    text: "180 дней. «Мир» = прекращение огня, заморозка конфликта или мирный договор. Шкала: -100 (война) → 0 (стагнация) → +100 (мир).",
  },
  {
    icon: Scale,
    title: "Маркеры и веса",
    text: "24 маркера в 6 группах. Финансовые и законодательные маркеры имеют максимальный вес (до 12). Политические — минимальный (до 3).",
  },
  {
    icon: Eye,
    title: "Дуговой спидометр",
    text: "Цветные сегменты = вклады групп маркеров. Левая сторона = факторы войны, правая = факторы мира. Длина сегмента ∝ вклад группы.",
  },
  {
    icon: Database,
    title: "Антигаллюцинации",
    text: "ИИ обязан ссылаться на URL источников. На сервере факты фильтруются: остаются только с URL из собранных данных.",
  },
  {
    icon: Clock,
    title: "Градиент давности",
    text: "Если по маркеру нет данных >14 дней, уверенность падает до LOW. Для тяжёлых маркеров (вес >8) индекс корректируется к нейтрали.",
  },
  {
    icon: BookOpen,
    title: "Источники данных",
    text: "IMF, MIGA, DFC, EBRD, Kiel, ISW, ACLED, Oryx, Verkhovna Rada, Prozorro, Eur-Lex, Kremlin, Reuters/AP, OSINT, Google News RSS.",
  },
];

export function MethodologyModal({ open, onClose }: MethodologyModalProps) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16 sm:pt-20"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Методология</h2>
                <p className="text-xs text-muted-foreground">Как считается индекс</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {BLOCKS.map((block, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-muted/40 p-4 transition hover:bg-muted/60"
                >
                  <block.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium">{block.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {block.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={onClose} variant="outline" size="sm">
                Закрыть
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

