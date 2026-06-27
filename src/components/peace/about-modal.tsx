"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, Globe, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
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
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">О проекте</h2>
                <p className="text-xs text-muted-foreground">Peace Index 180</p>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground">
              <p>
                <strong>Индекс Мира 180</strong> — некоммерческий аналитический проект,
                оценивающий вероятность наступления мира в Украине в течение 180 дней.
              </p>

              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">Открытые данные + ИИ</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Анализ 24 маркеров из 6 групп: финансы, законодательство, эскалация,
                    военные маркеры, российская сторона, политика.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">Горизонт прогноза</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    180 дней. Автообновление ежедневно в 02:00 UTC.
                    Шкала: -100 (война) → 0 (стагнация) → +100 (мир).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">Не является официальным прогнозом</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Проект создан энтузиастом для отслеживания динамики конфликта.
                    Пользователь сам решает, доверять ли оценке.
                  </p>
                </div>
              </div>
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

