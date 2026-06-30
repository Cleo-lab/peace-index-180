// lib/og-colors.ts
// OG Image Palette — HEX-эквиваленты oklch-цветов из colors.ts

export const OG_COLORS = {
  war: "#c41e3a",
  escalation: "#e85d04",
  stalemate: "#9ca3af",
  peace_tendency: "#f59e0b",
  high_peace: "#10b981",

  finance: "#059669",
  law: "#84cc16",
  escalation_group: "#991b1b",
  ukraine_military: "#be123c",
  russia: "#ea580c",
  politics: "#c026d3",

  bg_dark: "#000000",      // ← ЧЁРНЫЙ фон
  bg_card: "#0a0a0a",      // ← Тоже чёрный
  text_primary: "#f8fafc",
  text_secondary: "#94a3b8",
  text_muted: "#64748b",
  text_url: "#475569",
  track_bg: "#334155",
} as const;

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

// Подписи групп на двух языках
export const OG_GROUP_LABELS: Record<string, { ru: string; en: string }> = {
  finance: { ru: "Международные финансы", en: "Int'l Finance" },
  law: { ru: "Законодательство", en: "Legislation" },
  escalation: { ru: "Риск эскалации", en: "Escalation Risk" },
  ukraine_military: { ru: "Военные маркеры UA", en: "UA Military" },
  russia: { ru: "Маркеры РФ", en: "Russia" },
  politics: { ru: "Политика", en: "Politics" },
};
