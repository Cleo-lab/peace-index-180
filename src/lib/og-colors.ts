// lib/og-colors.ts
// OG Image Palette — HEX-эквиваленты oklch-цветов из colors.ts
// Satori (@vercel/og) не поддерживает oklch, поэтому используем HEX.
// Цвета максимально приближены к оригинальным oklch-значениям.

export const OG_COLORS = {
  // ===== Цвета тиров вероятности =====
  war: "#c41e3a",           // oklch(0.55 0.24 22) → deep rose
  escalation: "#e85d04",    // oklch(0.70 0.19 55) → orange
  stalemate: "#9ca3af",     // oklch(0.7 0 0) → neutral gray
  peace_tendency: "#f59e0b", // oklch(0.78 0.16 80) → amber
  high_peace: "#10b981",    // oklch(0.72 0.19 152) → emerald

  // ===== Цвета групп маркеров =====
  finance: "#059669",       // oklch(0.65 0.18 145) → emerald
  law: "#84cc16",           // oklch(0.78 0.16 95) → lime/yellow-green
  escalation_group: "#991b1b", // oklch(0.55 0.24 25) → deep red
  ukraine_military: "#be123c", // oklch(0.60 0.20 10) → rose
  russia: "#ea580c",        // oklch(0.70 0.19 55) → orange
  politics: "#c026d3",      // oklch(0.60 0.22 320) → magenta/purple

  // ===== Фон и текст =====
  bg_dark: "#0f172a",      // slate-900
  bg_card: "#1e293b",      // slate-800
  text_primary: "#f8fafc",  // slate-50
  text_secondary: "#94a3b8", // slate-400
  text_muted: "#64748b",    // slate-500
  text_url: "#475569",       // slate-600
  track_bg: "#334155",       // slate-700
} as const;

// Функция получения цвета группы для OG
export function ogGroupColor(groupKey: string): string {
  const map: Record<string, string> = {
    finance: OG_COLORS.finance,
    law: OG_COLORS.law,
    escalation: OG_COLORS.escalation_group,
    ukraine_military: OG_COLORS.ukraine_military,
    russia: OG_COLORS.russia,
    politics: OG_COLORS.politics,
  };
  return map[groupKey] ?? OG_COLORS.stalemate;
}

// Функция получения цвета по значению вероятности
export function ogProbabilityColor(p: number): string {
  if (p <= -60) return OG_COLORS.war;
  if (p <= -20) return OG_COLORS.escalation;
  if (p < 20) return OG_COLORS.stalemate;
  if (p < 60) return OG_COLORS.peace_tendency;
  return OG_COLORS.high_peace;
}

// Подписи тиров на двух языках
export function ogTierLabel(p: number, lang: "ru" | "en"): string {
  if (p <= -60) return lang === "en" ? "War" : "Война";
  if (p <= -30) return lang === "en" ? "Escalation" : "Эскалация";
  if (p <= -10) return lang === "en" ? "Tension" : "Напряжение";
  if (p <= 10) return lang === "en" ? "Stagnation" : "Стагнация";
  if (p <= 30) return lang === "en" ? "De-escalation" : "Деэскалация";
  if (p <= 60) return lang === "en" ? "Negotiations" : "Переговоры";
  return lang === "en" ? "Peace" : "Мир";
}

// Подписи групп на двух языках (короткие для OG-картинки)
export const OG_GROUP_LABELS: Record<string, { ru: string; en: string }> = {
  finance: { ru: "Международные финансы", en: "Int'l Finance" },
  law: { ru: "Законодательство", en: "Legislation" },
  escalation: { ru: "Риск эскалации", en: "Escalation Risk" },
  ukraine_military: { ru: "Военные маркеры UA", en: "UA Military" },
  russia: { ru: "Маркеры РФ", en: "Russia" },
  politics: { ru: "Политика", en: "Politics" },
};

