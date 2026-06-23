// Реестр маркеров для «Индекса Мира 180»
// Горизонт прогноза: 180 дней. Долгосрочные структурные маркеры имеют максимальный вес.
// Определение «Мира»: полное прекращение огня / заморозка конфликта / мирный договор.

export type MarkerGroup =
  | "finance"
  | "law"
  | "ukraine_military"
  | "russia"
  | "politics";

export type Trend = "UP" | "DOWN" | "FLAT";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface MarkerDef {
  id: string;
  code: string; // M1, M2...
  name: string;
  nameRu: string;
  group: MarkerGroup;
  weight: number;
  /// Основной поисковый запрос для web_search (английский — максимум качества)
  searchQuery: string;
  /// Описание логики маркера (передаётся в LLM-промпт)
  logic: string;
  /// Источники из спецификации (для отображения в UI)
  sources: string[];
}

export const GROUP_META: Record<
  MarkerGroup,
  { label: string; labelRu: string; weightTier: "high" | "medium" | "low" }
> = {
  finance: {
    label: "International Finance & Economy",
    labelRu: "Международные финансы и экономика",
    weightTier: "high",
  },
  law: {
    label: "Legislation & Privatization",
    labelRu: "Законодательство и приватизация",
    weightTier: "high",
  },
  ukraine_military: {
    label: "Ukraine Military Markers",
    labelRu: "Военные маркеры Украины",
    weightTier: "medium",
  },
  russia: {
    label: "Russian Side Markers",
    labelRu: "Маркеры российской стороны",
    weightTier: "medium",
  },
  politics: {
    label: "Politics & Info Field",
    labelRu: "Политика и инфополе",
    weightTier: "low",
  },
};

// Автоматически вычисляем текущий и прошлый годы, чтобы поиск всегда был актуальным
const currentYear = new Date().getFullYear(); // 2026
const prevYear = currentYear - 1; // 2025
const years = `${prevYear} ${currentYear}`; // "2025 2026"

export const MARKERS: MarkerDef[] = [
  // ===== Группа 1: Международные финансы и Экономика (Высокий вес) =====
  {
    id: "IMF_EFF",
    code: "M1",
    name: "IMF EFF Program",
    nameRu: "Программа IMF EFF",
    group: "finance",
    weight: 10,
    searchQuery: `IMF Extended Fund Facility Ukraine program review ${years} tranche disbursement`,
    logic: "Completion of an IMF EFF review = positive signal. Delays = negative. Continued disbursement indicates macro stabilization expected under peace.",
    sources: ["imf.org/en/News", "IMF Press Releases"],
  },
  {
    id: "WRI_INSURANCE",
    code: "M2",
    name: "War Risk Insurance & MIGA/DFC",
    nameRu: "Страхование военных рисков (MIGA/DFC)",
    group: "finance",
    weight: 10,
    searchQuery: `MIGA DFC war risk insurance Ukraine long-term guarantee investment facility ${years}`,
    logic: "New long-term (10+ years) war risk insurance policies are the strongest leading indicator of de-escalation, as markets price in durable peace.",
    sources: ["miga.org", "dfc.gov/news", "ukraineinvest.gov.ua"],
  },
  {
    id: "EBRD_PROJECTS",
    code: "M3",
    name: "EBRD Projects",
    nameRu: "Проекты ЕБРР",
    group: "finance",
    weight: 9,
    searchQuery: `EBRD European Bank Reconstruction Development Ukraine new projects investment ${years}`,
    logic: "New multi-year EBRD investments signal long-horizon confidence in Ukraine's stability.",
    sources: ["ebrd.com/where-we-invest/ukraine"],
  },
  {
    id: "KIEL_TRACKER",
    code: "M4",
    name: "Kiel Ukraine Support Tracker",
    nameRu: "Трекер помощи Kiel",
    group: "finance",
    weight: 8,
    searchQuery: `Kiel Institute Ukraine Support Tracker military financial aid update ${years}`,
    logic: "Sustained or increasing committed aid suggests continued war posture; declines or shifts to reconstruction packages suggest peace planning.",
    sources: ["kiel-institut.de Ukraine Support Tracker"],
  },
  {
    id: "PORTS_GRAIN",
    code: "M5",
    name: "Ports & Grain Corridor",
    nameRu: "Порты и зерновой коридор",
    group: "finance",
    weight: 8,
    searchQuery: `Ukraine Black Sea grain corridor ports exports shipping throughput ${years}`,
    logic: "Expanding commercial shipping through Black Sea ports and stable grain exports indicate de-escalation of the maritime threat.",
    sources: ["apk-inform.com/en/news", "uspa.gov.ua"],
  },

  // ===== Группа 2: Законодательство и Приватизация (Высокий вес) =====
  {
    id: "RADA_FDI",
    code: "M6",
    name: "Verkhovna Rada FDI Laws",
    nameRu: "Законы ВР по ПИИ",
    group: "law",
    weight: 9,
    searchQuery: `Verkhovna Rada Ukraine law foreign direct investment concession investor protection ${years}`,
    logic: "New laws easing foreign investor operations and concessions signal preparation for post-war reconstruction.",
    sources: ["rada.gov.ua/en/news"],
  },
  {
    id: "PROZORRO_PRIVAT",
    code: "M7",
    name: "Prozorro.Sale Large Privatization",
    nameRu: "Крупная приватизация Prozorro.Sale",
    group: "law",
    weight: 9,
    searchQuery: `Prozorro Sale Ukraine large privatization state assets tender ${years}`,
    logic: "Resumption of large privatization tenders indicates confidence in long-term stability.",
    sources: ["prozorro.sale API"],
  },
  {
    id: "EURLEX_EU",
    code: "M8",
    name: "EU Legislation (Eur-Lex)",
    nameRu: "Законодательство ЕС (Eur-Lex)",
    group: "law",
    weight: 8,
    searchQuery: `EUR-Lex European Union regulation Ukraine accession assistance fund ${years}`,
    logic: "EU legal acts on Ukraine accession, assistance funds, and reconstruction signal durable political commitment.",
    sources: ["eur-lex.europa.eu"],
  },

  // ===== Группа 3: Военные маркеры Украины (Средний вес) =====
  {
    id: "ISW_FRONTLINE",
    code: "M9",
    name: "Frontline Dynamics (ISW)",
    nameRu: "Динамика фронта (ISW)",
    group: "ukraine_military",
    weight: 6,
    // Усилено: теперь ищет не только фронт, но и угрозы границам (включая фланги со стороны Беларуси)
    searchQuery: `Institute for the Study of War ISW Ukraine frontline tactical assessment border escalation ${years}`,
    logic: "Stable or contracting active front line shifts indicate movement toward frozen conflict or ceasefire. Sudden escalation or border military movements signal prolongation risk.",
    sources: ["understandingwar.org"],
  },
  {
    id: "ACLED_INTENSITY",
    code: "M10",
    name: "Combat Intensity (ACLED)",
    nameRu: "Интенсивность боёв (ACLED)",
    group: "ukraine_military",
    weight: 6,
    searchQuery: `ACLED Ukraine conflict event data combat intensity casualties weekly ${years}`,
    logic: "Declining weekly combat event counts and casualty rates are direct indicators of de-escalation.",
    sources: ["acleddata.com (myACLED)"],
  },
  {
    id: "REAR_STRIKES_UA",
    code: "M11",
    name: "Rear Strikes (Ukraine)",
    nameRu: "Удары по тылу (Украина)",
    group: "ukraine_military",
    weight: 5,
    searchQuery: `Ukraine air alerts ballistic missile drone strike rear cities Kyiv Odesa ${years}`,
    logic: "Frequency and duration of air alerts and rear strikes inversely correlate with proximity to peace.",
    sources: ["alerts.com.ua API"],
  },
  {
    id: "ORYX_LOSSES",
    code: "M12",
    name: "Equipment Losses (Oryx)",
    nameRu: "Потери техники (Oryx)",
    group: "ukraine_military",
    weight: 5,
    searchQuery: `Oryx Russia Ukraine equipment losses visually confirmed count tanks vehicles ${years}`,
    logic: "Rate of visually confirmed equipment losses tracks active combat intensity; a sustained drop signals de-escalation.",
    sources: ["github.com/leedrake5/russia-ukraine"],
  },

  // ===== Группа 4: Маркеры Российской стороны (Средний вес) =====
  {
    id: "RU_RHETORIC",
    code: "M13",
    name: "Russian Official Rhetoric",
    nameRu: "Официальная риторика РФ",
    group: "russia",
    weight: 4,
    searchQuery: `Kremlin Russia official statement Ukraine negotiations goals talks Lavrov Putin ${years}`,
    logic: "Shift from 'goals of SMO will be achieved' to 'ready for negotiations' is a strong peace signal.",
    sources: ["kremlin.ru", "mid.ru"],
  },
  {
    id: "RU_REAR_ECONOMY",
    code: "M14",
    name: "Russian Rear Strikes & Economy",
    nameRu: "Удары по тылу и экономика РФ",
    group: "russia",
    weight: 4,
    searchQuery: `Russia drone strike refinery oil facility economy sanctions budget deficit ${years}`,
    logic: "Strikes on Russian refineries and budget stress increase Moscow's incentive to negotiate.",
    sources: ["Reuters", "AP"],
  },
  {
    id: "RU_BUDGET_MOBIL",
    code: "M15",
    name: "Russian Budget/Mobilization",
    nameRu: "Бюджет/мобилизация РФ",
    group: "russia",
    weight: 5,
    searchQuery: `Russia state budget defense spending mobilization decree conscription Duma ${years}`,
    logic: "Surging defense budget and new mobilization waves indicate war continuation; freezes/reductions signal readiness to settle.",
    sources: ["OSINT Telegram", "State Duma news"],
  },

  // ===== Группа 5: Политика и Инфополе (Низкий вес) =====
  {
    id: "G7_WH_STATEMENTS",
    code: "M16",
    name: "G7 / White House Statements",
    nameRu: "Заявления G7 / Белого дома",
    group: "politics",
    weight: 2,
    searchQuery: `G7 White House statement Ukraine peace summit strategy support ${years}`,
    logic: "Diplomatic statements calling for peace talks or a settlement plan raise short-term probability.",
    sources: ["whitehouse.gov", "Reuters", "AP"],
  },
  {
    id: "OSINT_TELEGRAM",
    code: "M17",
    name: "OSINT Telegram Channels",
    nameRu: "OSINT Telegram-каналы",
    group: "politics",
    weight: 1,
    // Усилено: теперь робот активно собирает резкую риторику лидеров, заявления по Польше, Беларуси и угрозы эскалации
    searchQuery: `OSINT Telegram Ukraine war sharp statement Zelensky escalation Belarus Poland ${years}`,
    logic: "Aggregate sentiment of top OSINT channels provides a noisy but timely signal of perceived de-escalation or acute political spikes.",
    sources: ["Top-10 OSINT Telegram channels"],
  },
];

export const MARKER_MAP: Record<string, MarkerDef> = Object.fromEntries(
  MARKERS.map((m) => [m.id, m]),
);

export const TOTAL_WEIGHT = MARKERS.reduce((s, m) => s + m.weight, 0);

export function groupMarkers(): Record<MarkerGroup, MarkerDef[]> {
  const out: Record<MarkerGroup, MarkerDef[]> = {
    finance: [],
    law: [],
    ukraine_military: [],
    russia: [],
    politics: [],
  };
  for (const m of MARKERS) out[m.group].push(m);
  return out;
}
