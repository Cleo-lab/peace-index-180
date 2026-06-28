"use client";

import { useLanguage } from "@/components/peace/language-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  variant?: "default" | "dark";
}

export function LanguageToggle({ variant = "default" }: LanguageToggleProps) {
  const { lang, setLang } = useLanguage();
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "flex items-center rounded-full border p-0.5",
        isDark
          ? "border-white/20 bg-white/10"
          : "border-border/60 bg-muted/50"
      )}
    >
      <Button
        variant={lang === "ru" ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-7 rounded-full px-2.5 text-xs font-medium",
          isDark && lang !== "ru" && "text-white/60 hover:bg-white/10 hover:text-white"
        )}
        onClick={() => setLang("ru")}
      >
        RU
      </Button>
      <Button
        variant={lang === "en" ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-7 rounded-full px-2.5 text-xs font-medium",
          isDark && lang !== "en" && "text-white/60 hover:bg-white/10 hover:text-white"
        )}
        onClick={() => setLang("en")}
      >
        EN
      </Button>
    </div>
  );
}
