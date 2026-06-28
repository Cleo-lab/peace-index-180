"use client";

import * as React from "react";

type Lang = "en" | "ru";

const UI_TEXT: Record<Lang, Record<string, string>> = {
  ru: {
    appTitle: "Индекс Мира 180",
    appSubtitle: "Peace Index 180 · AI-аналитика открытых данных",
    structureTitle: "Структура индекса",
    structureSubtitle: "{count} маркеров в 6 группах · кликните группу, чтобы раскрыть её маркеры",
    expandAll: "Раскрыть все",
    collapseAll: "Свернуть все",
    methodologyTitle: "Как считается индекс",
    methodologySubtitle: "Методология, маркеры, шкала -100..+100 и источники данных",
    horizon: "горизонт 180 дней",
    markersCount: "маркеров",
    footerProject: "Peace Index 180 · некоммерческий проект · open data + AI",
    footerSchedule: "горизонт 180 дней · автообновление ежедневно в 02:00 UTC",
    emptyCalculating: "Идёт первый расчёт…",
    emptyNoData: "Данных пока нет",
    emptySchedule: "Первый расчёт выполняется автоматически по расписанию (02:00 UTC). Пожалуйста, проверьте позже или запустите вручную через GitHub Actions.",
    heroSubtitle: "— динамика мира/войны за 180 дней",
    heroDescription: "Круговой индикатор: -100 - 0 = война, 0 = стагнация, 0 + 100 = мир. Каждый цветной сегмент — вклад группы маркеров.",
    summaryLabelRu: "Обоснование · RU",
    summaryLabelEn: "Обоснование · EN",
    phaseAnalyzing: "ИИ-анализ маркеров",
    phaseAggregating: "Агрегация индекса",
    phaseDone: "Готово",
    phaseError: "Ошибка",
    weight: "вес",
  weightHigh: "Высокий вес",
  weightMedium: "Средний вес",
  weightLow: "Низкий вес",
  contribution: "вклад",
  confidence: "Уверенность",
  rationale: "Обоснование",
  russian: "Русский",
  translateToRussian: "Перевести на русский",
  keyFacts: "Ключевые факты (с источниками)",
  source: "источник",
  noVerifiedFacts: "Модель не предоставила верифицируемых фактов с URL из входных данных.",
    widgetRationale: "Обоснование",
    widgetRationaleTitle: "Обоснование оценки",
    widgetDetails: "Детальнее",
    widgetShare: "Поделиться",
    widgetCopied: "Ссылка скопирована в буфер обмена!",
  },
  en: {
    appTitle: "Peace Index 180",
    appSubtitle: "Peace Index 180 · Open data AI analytics",
    structureTitle: "Index Structure",
    structureSubtitle: "{count} markers in 6 groups · click a group to expand its markers",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    methodologyTitle: "How the index is calculated",
    methodologySubtitle: "Methodology, markers, -100..+100 scale and data sources",
    horizon: "180-day horizon",
    markersCount: "markers",
    footerProject: "Peace Index 180 · non-profit project · open data + AI",
    footerSchedule: "180-day horizon · auto-updates daily at 02:00 UTC",
    emptyCalculating: "First calculation in progress…",
    emptyNoData: "No data yet",
    emptySchedule: "The first calculation runs automatically on schedule (02:00 UTC). Please check back later or trigger manually via GitHub Actions.",
    heroSubtitle: "— peace/war dynamics over 180 days",
    heroDescription: "Circular indicator: -100 to 0 = war, 0 = stagnation, 0 to +100 = peace. Each colored segment is a marker group's contribution.",
    summaryLabelRu: "Rationale · RU",
    summaryLabelEn: "Rationale · EN",
    phaseAnalyzing: "AI marker analysis",
    phaseAggregating: "Index aggregation",
    phaseDone: "Done",
    phaseError: "Error",
    weight: "weight",
  weightHigh: "High weight",
  weightMedium: "Medium weight",
  weightLow: "Low weight",
  contribution: "contribution",
  confidence: "Confidence",
  rationale: "Rationale",
  russian: "Russian",
  translateToRussian: "Translate to Russian",
  keyFacts: "Key facts (with sources)",
  source: "source",
  noVerifiedFacts: "The model did not provide verifiable facts with URLs from input data.",
    widgetRationale: "Rationale",
    widgetRationaleTitle: "Assessment rationale",
    widgetDetails: "Details",
    widgetShare: "Share",
    widgetCopied: "Link copied to clipboard!",
  },
};

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (ru: string, en: string) => string;
  tx: (key: string) => string;
}

const LanguageContext = React.createContext<LanguageContextType>({
  lang: "ru",
  setLang: () => {},
  t: (_ru, en) => en,
  tx: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("ru");

  React.useEffect(() => {
    const saved = localStorage.getItem("pi180-lang") as Lang | null;
    if (saved === "en" || saved === "ru") setLangState(saved);
  }, []);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("pi180-lang", l);
  }, []);

  const t = React.useCallback(
    (ru: string, en: string) => (lang === "ru" ? ru : en),
    [lang]
  );

  const tx = React.useCallback(
    (key: string) => UI_TEXT[lang][key] ?? key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tx }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
