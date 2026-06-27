// Цветовое кодирование вероятности мира/войны (избегаем indigo/blue по стилистике проекта).
// Шкала: -100 (война) → 0 (стагнация) → +100 (мир)
// Красный/розовый = война; оранжевый = эскалация; серый = стагнация;
// янтарный = мирная тенденция; зелёный = высокая вероятность мира.

export type ProbabilityTier = "war" | "escalation" | "stalemate" | "peace_tendency" | "high_peace";

export function probabilityTier(p: number): ProbabilityTier {
  if (p <= -60) return "war";
  if (p <= -20) return "escalation";
  if (p < 20) return "stalemate";
  if (p < 60) return "peace_tendency";
  return "high_peace";
}

export function probabilityColor(p: number): string {
  const t = probabilityTier(p);
  if (t === "war") return "oklch(0.55 0.24 22)"; // deep rose — война
  if (t === "escalation") return "oklch(0.70 0.19 55)"; // orange — эскалация
  if (t === "stalemate") return "oklch(0.7 0 0)"; // neutral gray — стагнация
  if (t === "peace_tendency") return "oklch(0.78 0.16 80)"; // amber — мирная тенденция
  return "oklch(0.72 0.19 152)"; // emerald — высокая вероятность мира
}

export function probabilityLabelRu(p: number): string {
  const t = probabilityTier(p);
  if (t === "war") return "Высокий риск войны";
  if (t === "escalation") return "Рост эскалации";
  if (t === "stalemate") return "Стагнация";
  if (t === "peace_tendency") return "Мирная тенденция";
  return "Высокая вероятность мира";
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
// 6 контрастных цветов, без indigo/blue.
export const GROUP_COLORS: Record<string, string> = {
  finance: "oklch(0.65 0.18 145)",     // emerald — финансы
  law: "oklch(0.78 0.16 95)",          // lime/yellow-green — законодательство (было слишком близко к finance)
  escalation: "oklch(0.55 0.24 25)",   // deep red — эскалация (тёмнее, чтобы отличаться от ukraine_military)
  ukraine_military: "oklch(0.60 0.20 10)", // rose — военные UA (светлее и более розовый, чем escalation)
  russia: "oklch(0.70 0.19 55)",       // orange — РФ
  politics: "oklch(0.60 0.22 320)",    // magenta/purple — политика (более фиолетовый)
};

export function groupColor(groupKey: string): string {
  return GROUP_COLORS[groupKey] ?? "oklch(0.7 0 0)";
}

// ===== Градиент для кругового спидометра (360°) =====
// Возвращает цвет для любого угла 0-360, где 0° = -100 (война), 180° = 0 (стагнация), 360° = +100 (мир)
export function gaugeColorAtAngle(angleDeg: number): string {
  // Нормализуем угол к шкале -100..+100
  const p = (angleDeg / 180) * 100 - 100;
  return probabilityColor(p);
}

// ===== CSS-градиент для фона спидометра =====
export function gaugeBackgroundGradient(): string {
  return `conic-gradient(
    from 180deg,
    oklch(0.55 0.24 22) 0deg 72deg,
    oklch(0.70 0.19 55) 72deg 144deg,
    oklch(0.7 0 0) 144deg 216deg,
    oklch(0.78 0.16 80) 216deg 288deg,
    oklch(0.72 0.19 152) 288deg 360deg
  )`;
}
