"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/components/peace/language-context";

interface DonateModalProps {
  open: boolean;
  onClose: () => void;
}

const WALLETS = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    address: "bc1qn2395qfw5fknxa83lhyzhrmx7umsj3eyygeph9",
    color: "#F7931A",
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    address: "0xBA9abB423596974f4908f12F92CBd9D64b38447b",
    color: "#627EEA",
  },
  {
    name: "USDT TRC-20",
    symbol: "USDT",
    address: "TJh83QXwZK38hXvwXhEodErZakJhgasSfx",
    color: "#26A17B",
  },
];

export function DonateModal({ open, onClose }: DonateModalProps) {
  const { tx } = useLanguage();
  const [copied, setCopied] = React.useState<string | null>(null);

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

  async function copyAddress(address: string, symbol: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(symbol);
      toast.success(tx("donateCopied"));
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(tx("donateCopyError"));
    }
  }

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
            className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{tx("donateTitle")}</h2>
                <p className="text-xs text-muted-foreground">{tx("donateSubtitle")}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {tx("donateDescription")}
            </p>

            <div className="mt-5 space-y-3">
              {WALLETS.map((wallet) => (
                <div
                  key={wallet.symbol}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: wallet.color }}
                      />
                      <span className="text-sm font-medium">{wallet.name}</span>
                      <span className="text-xs text-muted-foreground">({wallet.symbol})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => copyAddress(wallet.address, wallet.symbol)}
                    >
                      {copied === wallet.symbol ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied === wallet.symbol ? tx("donateCopiedBtn") : tx("donateCopyBtn")}
                    </Button>
                  </div>
                  <code className="mt-2 block break-all rounded-lg bg-background p-2 text-[11px] text-muted-foreground">
                    {wallet.address}
                  </code>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-muted/30 p-4">
              <p className="text-sm font-medium">{tx("donateThanks")}</p>
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
