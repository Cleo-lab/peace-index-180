// Цветовое кодирование вероятности мира (избегаем indigo/blue по стилистике проекта).
// Зелёный = высокая вероятность мира; янтарный = средняя; розовый = низкая.

export function probabilityTier(p: number): "high" | "medium" | "low" {
  if (p >= 60) return "high";
  if (p >= 30) return "medium";
  return "low";
}

export function probabilityColor(p: number): string {
  const t = probabilityTier(p);
  if (t === "high") return "oklch(0.72 0.19 152)"; // emerald
  if (t === "medium") return "oklch(0.78 0.16 80)"; // amber
  return "oklch(0.65 0.22 22)"; // rose
}

export function probabilityLabelRu(p: number): string {
  const t = probabilityTier(p);
  if (t === "high") return "Высокая";
  if (t === "medium") return "Средняя";
  return "Низкая";
}

export function confidenceLabelRu(c: string): string {
  if (c === "HIGH") return "Высокая";
  if (c === "MEDIUM") return "Средняя";
  return "Низкая";
}

export function trendLabelRu(t: string): { label: string; icon: string } {
  if (t === "UP") return { label: "Растёт", icon: "▲" };
  if (t === "DOWN") return { label: "Падает", icon: "▼" };
  return { label: "Стабильно", icon: "▬" };
}

export function confidenceColor(c: string): string {
  if (c === "HIGH") return "oklch(0.72 0.19 152)";
  if (c === "MEDIUM") return "oklch(0.78 0.16 80)";
  return "oklch(0.65 0.22 22)";
}

export function trendColor(t: string): string {
  if (t === "UP") return "oklch(0.72 0.19 152)";
  if (t === "DOWN") return "oklch(0.65 0.22 22)";
  return "oklch(0.7 0 0)";
}

// ===== Фиксированные цвета групп маркеров =====
// Используются в спидометре (сегменты дуги), карточках групп, аккордеонах.
// 5 контрастных цветов, без indigo/blue.
export const GROUP_COLORS: Record<string, string> = {
  finance: "oklch(0.72 0.19 152)", // emerald — финансы/инвестиции
  law: "oklch(0.80 0.19 125)", // lime — законодательство
  ukraine_military: "oklch(0.64 0.22 18)", // rose — военные UA
  russia: "oklch(0.70 0.19 55)", // orange — РФ
  politics: "oklch(0.65 0.24 350)", // magenta — политика
};

export function groupColor(groupKey: string): string {
  return GROUP_COLORS[groupKey] ?? "oklch(0.7 0 0)";
}
