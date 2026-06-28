"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Info, BookOpen, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/peace/language-context";

interface BurgerMenuProps {
  onAbout: () => void;
  onMethodology: () => void;
  onDonate: () => void;
}

export function BurgerMenu({ onAbout, onMethodology, onDonate }: BurgerMenuProps) {
  const { tx } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("touchstart", onClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, [open]);

  const items = [
    { label: tx("menuAbout"), icon: Info, onClick: () => { onAbout(); setOpen(false); } },
    { label: tx("menuMethodology"), icon: BookOpen, onClick: () => { onMethodology(); setOpen(false); } },
    { label: tx("menuDonate"), icon: Heart, onClick: () => { onDonate(); setOpen(false); }, accent: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg transition",
          open
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        aria-label={tx("menuTitle")}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
            >
              <Menu className="h-5 w-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg"
          >
            {items.map((item, i) => (
              <React.Fragment key={item.label}>
                {i === 2 && <div className="my-1 h-px bg-border" />}
                <button
                  onClick={item.onClick}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition",
                    item.accent
                      ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", item.accent && "fill-current")} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
