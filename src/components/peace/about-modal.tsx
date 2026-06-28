"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, Globe, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/peace/language-context";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const { tx } = useLanguage();

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
                <h2 className="text-lg font-bold">{tx("aboutTitle")}</h2>
                <p className="text-xs text-muted-foreground">{tx("aboutSubtitle")}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground">
              <p>
                <strong>Peace Index 180</strong> — {tx("aboutP1")}
              </p>

              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">{tx("aboutOpenDataTitle")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tx("aboutOpenDataText")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">{tx("aboutHorizonTitle")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tx("aboutHorizonText")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">{tx("aboutDisclaimerTitle")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tx("aboutDisclaimerText")}
                  </p>
                </div>
              </div>
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
