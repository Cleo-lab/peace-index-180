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
    widgetShareText: "Оценка вероятности мира в Украине",
    // Меню
    menuTitle: "Меню",
    menuAbout: "О проекте",
    menuMethodology: "Методология",
    menuDonate: "Поддержать",
    // Дисклеймер
    disclaimerText: "Приложение оценивает вероятность наступления мира на основе открытых данных с помощью ИИ. Оно не претендует на абсолютную точность и не является официальным прогнозом. Пользователь сам решает, доверять ли этой оценке.",
    // О проекте
    aboutTitle: "О проекте",
    aboutSubtitle: "Peace Index 180",
    aboutP1: "некоммерческий аналитический проект, оценивающий вероятность наступления мира в Украине в течение 180 дней.",
    aboutOpenDataTitle: "Открытые данные + ИИ",
    aboutOpenDataText: "Анализ 25 маркеров из 6 групп: финансы, законодательство, эскалация, военные маркеры, российская сторона, политика.",
    aboutHorizonTitle: "Горизонт прогноза",
    aboutHorizonText: "180 дней. Автообновление ежедневно в 02:00 UTC. Шкала: -100 (война) → 0 (стагнация) → +100 (мир).",
    aboutDisclaimerTitle: "Не является официальным прогнозом",
    aboutDisclaimerText: "Проект создан энтузиастом для отслеживания динамики конфликта. Пользователь сам решает, доверять ли оценке.",
    // Методология (модал)
    methodologyModalTitle: "Методология",
    methodologyModalSubtitle: "Как считается индекс",
    methodologyHorizon: "Горизонт прогноза",
    methodologyHorizonText: "180 дней. «Мир» = прекращение огня, заморозка конфликта или мирный договор. Шкала: -100 (война) → 0 (стагнация) → +100 (мир).",
    methodologyMarkers: "Маркеры и веса",
    methodologyMarkersText: "25 маркеров в 6 группах. Финансовые и законодательные маркеры (инвесторы, страховщики, международные финансовые институты) имеют максимальный вес (до 12) — как самый надёжный опережающий индикатор. Дипломатические и политические сигналы — минимальный вес (до 3): дополняют картину, но не определяют её.",
    methodologyGauge: "Дуговой спидометр",
    methodologyGaugeText: "Цветные сегменты = вклады групп маркеров. Левая сторона = факторы войны, правая = факторы мира. Длина сегмента ∝ вклад группы.",
    methodologyAntiHallucination: "Антигаллюцинации",
    methodologyAntiHallucinationText: "ИИ обязан ссылаться на URL источников для каждого факта. На сервере факты фильтруются: остаются только те, чей URL реально есть в собранных данных. То же правило действует для отслеживаемых позиций конкретных инвесторов и институтов (например, изменений в объявленных суммах инвестиций).",
    methodologyGradient: "Свежесть данных",
    methodologyGradientText: "Маркеры эскалации и военной обстановки анализируются в окне последних 7 дней — устаревшие статьи не могут вытеснить сегодняшние события. Финансовые/юридические маркеры используют окно 30 дней, так как решения инвесторов не устаревают за неделю. Маркеры с низкой уверенностью получают пропорционально меньший вес в среднем — вместо того, чтобы искусственно тянуть индекс к нулю.",
    methodologySources: "Источники данных",
    methodologySourcesText: "Tavily (основной поиск, с фильтром по свежести), Google News RSS (резервный источник), а также IMF, MIGA, DFC, EBRD, Kiel, ISW, ACLED, Oryx, Верховная Рада, Prozorro, Eur-Lex, Кремль, Reuters/AP, OSINT.",
    // Поддержать
    donateTitle: "Поддержать проект",
    donateSubtitle: "Криптовалюта",
    donateDescription: "Peace Index 180 — это независимый некоммерческий проект, который ежедневно оценивает вероятность наступления мира в течение ближайших 180 дней на основе открытых данных и анализа с помощью искусственного интеллекта. Если вы считаете проект полезным и хотите помочь его развитию, вы можете поддержать его добровольным пожертвованием в криптовалюте. Спасибо за поддержку.",
    donateCopied: "Адрес скопирован",
    donateCopyError: "Не удалось скопировать",
    donateCopiedBtn: "Скопировано",
    donateCopyBtn: "Копировать",
    donateThanks: "Спасибо!",
    // Общее
    close: "Закрыть",
    // Методология на главной (Collapsible)
    methodologyForecastHorizon: "Горизонт прогноза",
    methodologyForecastHorizonText: "180 дней. «Мир» = прекращение огня, заморозка конфликта или мирный договор. Шкала: -100 (война) → 0 (стагнация) → +100 (мир).",
    methodologyMarkersWeights: "Маркеры и веса",
    methodologyMarkersWeightsText: "25 маркеров в 6 группах. Финансовые и законодательные маркеры (инвесторы, страховщики, международные финансовые институты) имеют максимальный вес (до 12) — как самый надёжный опережающий индикатор. Дипломатические и политические сигналы — минимальный вес (до 3): дополняют картину, но не определяют её.",
    methodologyArcGauge: "Дуговой спидометр",
    methodologyArcGaugeText: "Цветные сегменты = вклады групп маркеров. Левая сторона = факторы войны, правая = факторы мира. Длина сегмента ∝ вклад группы.",
    methodologyAntiHallucinationMain: "Антигаллюцинации",
    methodologyAntiHallucinationMainText: "ИИ обязан ссылаться на URL источников для каждого факта. На сервере факты фильтруются: остаются только те, чей URL реально есть в собранных данных. То же правило действует для отслеживаемых позиций конкретных инвесторов и институтов.",
    methodologyRecencyGradient: "Свежесть данных",
    methodologyRecencyGradientText: "Маркеры эскалации анализируются в окне последних 7 дней — устаревшие статьи не вытесняют сегодняшние события. Финансовые/юридические маркеры используют окно 30 дней. Маркеры с низкой уверенностью получают пропорционально меньший вес — вместо искусственного притягивания индекса к нулю.",
    methodologyDataSources: "Источники данных",
    methodologyDataSourcesText: "Tavily (основной поиск, с фильтром по свежести), Google News RSS (резерв), IMF, MIGA, DFC, EBRD, Kiel, ISW, ACLED, Oryx, Верховная Рада, Prozorro, Eur-Lex, Кремль, Reuters/AP, OSINT.",
    historyTitle: "История индекса",
historySubtitle: "Динамика итоговой вероятности мира во времени",
historyDays: "д",
historyTooltipLabel: "Вероятность",
historyNoData: "Недостаточно данных для построения графика. Запустите анализ несколько дней подряд.",
runPanelTitle: "Пересчёт индекса",
runPanelSubtitle: "ИИ-анализ {count} маркеров с Google Search → агрегация. Обычно занимает 2–3 минуты.",
runPanelBtnRunning: "Идёт пересчёт…",
runPanelBtnIdle: "Запустить пересчёт",
runPanelAlreadyRunning: "Пересчёт уже выполняется",
runPanelStarted: "Пересчёт запущен в фоне",
runPanelError: "Не удалось запустить пересчёт",
runPhaseAnalyzing: "ИИ-анализ маркеров (с Google Search)",
runPhaseAggregating: "Агрегация индекса",
runPhaseDone: "Готово",
runPhaseError: "Ошибка",
runLastDone: "Последний пересчёт завершён",
runLastError: "Ошибка",
runElapsed: "за {sec}с",
runLastCalc: "Последний расчёт",
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
    widgetShareText: "Peace probability assessment for Ukraine",
    // Menu
    menuTitle: "Menu",
    menuAbout: "About",
    menuMethodology: "Methodology",
    menuDonate: "Support",
    // Disclaimer
    disclaimerText: "The application assesses the probability of peace based on open data using AI. It does not claim absolute accuracy and is not an official forecast. The user decides whether to trust this assessment.",
    // About
    aboutTitle: "About",
    aboutSubtitle: "Peace Index 180",
    aboutP1: "a non-commercial analytical project assessing the probability of peace in Ukraine within 180 days.",
    aboutOpenDataTitle: "Open Data + AI",
    aboutOpenDataText: "Analysis of 25 markers in 6 groups: finance, legislation, escalation, military markers, Russian side, politics.",
    aboutHorizonTitle: "Forecast Horizon",
    aboutHorizonText: "180 days. Auto-update daily at 02:00 UTC. Scale: -100 (war) → 0 (stagnation) → +100 (peace).",
    aboutDisclaimerTitle: "Not an Official Forecast",
    aboutDisclaimerText: "The project was created by an enthusiast to track conflict dynamics. The user decides whether to trust the assessment.",
    // Methodology (modal)
    methodologyModalTitle: "Methodology",
    methodologyModalSubtitle: "How the index is calculated",
    methodologyHorizon: "Forecast Horizon",
    methodologyHorizonText: "180 days. 'Peace' = ceasefire, conflict freeze, or peace treaty. Scale: -100 (war) → 0 (stagnation) → +100 (peace).",
    methodologyMarkers: "Markers & Weights",
    methodologyMarkersText: "25 markers in 6 groups. Financial and legislative markers (investors, insurers, international financial institutions) carry maximum weight (up to 12) — the most reliable leading indicator. Diplomatic and political signals carry minimum weight (up to 3): they add context but don't drive the score.",
    methodologyGauge: "Arc Speedometer",
    methodologyGaugeText: "Colored segments = group contributions. Left side = war factors, right = peace factors. Segment length ∝ group contribution.",
    methodologyAntiHallucination: "Anti-Hallucination",
    methodologyAntiHallucinationText: "The AI must cite a source URL for every fact. Facts are filtered server-side: only those whose URL is actually present in the collected data are kept. The same rule applies to tracked positions of specific investors and institutions (e.g. changes in announced investment amounts).",
    methodologyGradient: "Data Freshness",
    methodologyGradientText: "Escalation and military markers are analyzed within a 7-day window — stale articles can't crowd out today's events. Financial/legal markers use a 30-day window, since investor decisions don't go stale in a week. Low-confidence markers get proportionally less weight in the average, instead of artificially pulling the whole index toward zero.",
    methodologySources: "Data Sources",
    methodologySourcesText: "Tavily (primary search, with a freshness filter), Google News RSS (fallback source), plus IMF, MIGA, DFC, EBRD, Kiel, ISW, ACLED, Oryx, Verkhovna Rada, Prozorro, Eur-Lex, Kremlin, Reuters/AP, OSINT.",
    // Donate
    donateTitle: "Support the project",
    donateSubtitle: "Cryptocurrency",
    donateDescription: "Peace Index 180 is an independent non-profit project that daily assesses the probability of peace within the next 180 days based on open data and AI analysis. If you find the project useful and want to help its development, you can support it with a voluntary cryptocurrency donation. Thank you for your support.",
    donateCopied: "Address copied",
    donateCopyError: "Failed to copy",
    donateCopiedBtn: "Copied",
    donateCopyBtn: "Copy",
    donateThanks: "Thank you!",
    // Common
    close: "Close",
    // Methodology on main page (Collapsible)
    methodologyForecastHorizon: "Forecast Horizon",
    methodologyForecastHorizonText: "180 days. 'Peace' = ceasefire, conflict freeze, or peace treaty. Scale: -100 (war) → 0 (stagnation) → +100 (peace).",
    methodologyMarkersWeights: "Markers & Weights",
    methodologyMarkersWeightsText: "25 markers in 6 groups. Financial and legislative markers (investors, insurers, international financial institutions) carry maximum weight (up to 12) — the most reliable leading indicator. Diplomatic and political signals carry minimum weight (up to 3): they add context but don't drive the score.",
    methodologyArcGauge: "Arc Speedometer",
    methodologyArcGaugeText: "Colored segments = group contributions. Left side = war factors, right = peace factors. Segment length ∝ group contribution.",
    methodologyAntiHallucinationMain: "Anti-Hallucination",
    methodologyAntiHallucinationMainText: "The AI must cite a source URL for every fact. Facts are filtered server-side: only those whose URL is actually present in the collected data are kept. The same rule applies to tracked positions of specific investors and institutions.",
    methodologyRecencyGradient: "Data Freshness",
    methodologyRecencyGradientText: "Escalation markers are analyzed within a 7-day window — stale articles can't crowd out today's events. Financial/legal markers use a 30-day window. Low-confidence markers get proportionally less weight, instead of artificially pulling the index toward zero.",
    methodologyDataSources: "Data Sources",
    methodologyDataSourcesText: "Tavily (primary search, with a freshness filter), Google News RSS (fallback), IMF, MIGA, DFC, EBRD, Kiel, ISW, ACLED, Oryx, Verkhovna Rada, Prozorro, Eur-Lex, Kremlin, Reuters/AP, OSINT.",
    historyTitle: "Index History",
historySubtitle: "Dynamics of total peace probability over time",
historyDays: "d",
historyTooltipLabel: "Probability",
historyNoData: "Not enough data to build the chart. Run analysis for several days in a row.",
runPanelTitle: "Recalculate Index",
runPanelSubtitle: "AI analysis of {count} markers with Google Search → aggregation. Usually takes 2–3 minutes.",
runPanelBtnRunning: "Recalculating…",
runPanelBtnIdle: "Start recalculation",
runPanelAlreadyRunning: "Recalculation is already running",
runPanelStarted: "Recalculation started in background",
runPanelError: "Failed to start recalculation",
runPhaseAnalyzing: "AI marker analysis (with Google Search)",
runPhaseAggregating: "Index aggregation",
runPhaseDone: "Done",
runPhaseError: "Error",
runLastDone: "Last recalculation completed",
runLastError: "Error",
runElapsed: "in {sec}s",
runLastCalc: "Last calculation",
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
