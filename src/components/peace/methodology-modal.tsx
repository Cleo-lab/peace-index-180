"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Target, Scale, Eye, Database, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/peace/language-context";

interface MethodologyModalProps {
  open: boolean;
  onClose: () => void;
}

export function MethodologyModal({ open, onClose }: MethodologyModalProps) {
  const { tx } = useLanguage();

  const BLOCKS = [
    {
      icon: Target,
      title: tx("methodologyHorizon"),
      text: tx("methodologyHorizonText"),
    },
    {
      icon: Scale,
      title: tx("methodologyMarkers"),
      text: tx("methodologyMarkersText"),
    },
    {
      icon: Eye,
      title: tx("methodologyGauge"),
      text: tx("methodologyGaugeText"),
    },
    {
      icon: Database,
      title: tx("methodologyAntiHallucination"),
      text: tx("methodologyAntiHallucinationText"),
    },
    {
      icon: Clock,
      title: tx("methodologyGradient"),
      text: tx("methodologyGradientText"),
    },
    {
      icon: BookOpen,
      title: tx("methodologySources"),
      text: tx("methodologySourcesText"),
    },
  ];

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
                <h2 className="text-lg font-bold">{tx("methodologyModalTitle")}</h2>
                <p className="text-xs text-muted-foreground">{tx("methodologyModalSubtitle")}</p>
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
                {tx("close")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
