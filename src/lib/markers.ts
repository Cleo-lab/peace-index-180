// Реестр маркеров для «Индекса Мира 180»
// Горизонт прогноза: 180 дней. Долгосрочные структурные маркеры имеют максимальный вес.
// Определение «Мира»: полное прекращение огня / заморозка конфликта / мирный договор.
// ШКАЛА: -100 (макс. эскалация) → 0 (стагнация) → +100 (гарантированный мир)

export type MarkerGroup =
  | "finance"
  | "law"
  | "escalation"
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
  escalation: {
    label: "Escalation Risk Signals",
    labelRu: "Сигналы риска эскалации",
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
  // ===== Группа 1: Международные финансы и Экономика (Высочайший вес) =====
  {
    id: "IMF_EFF",
    code: "M1",
    name: "IMF EFF Program",
    nameRu: "Программа IMF EFF",
    group: "finance",
    weight: 12,
    searchQuery: `IMF Extended Fund Facility Ukraine program review ${years} tranche disbursement conditionality`,
    logic: "Completion of an IMF EFF review and disbursement = strong positive (+60 to +90). Delays or suspension = negative (-20 to -40). Continued disbursement indicates macro stabilization expected under peace. The IMF only disburses when it believes Ukraine can service debt — this implies 180-day stability horizon.",
    sources: ["imf.org/en/News", "IMF Press Releases"],
  },
  {
    id: "WRI_INSURANCE",
    code: "M2",
    name: "War Risk Insurance & MIGA/DFC",
    nameRu: "Страхование военных рисков (MIGA/DFC)",
    group: "finance",
    weight: 12,
    searchQuery: `Ukraine foreign investment guarantee insurance risk MIGA DFC World Bank ${years}`,
    logic: "New long-term (10+ years) war risk insurance policies are the strongest leading indicator of de-escalation (+70 to +100), as markets price in durable peace. Withdrawal or non-renewal of existing policies = strong negative (-50 to -80).",
    sources: ["miga.org", "dfc.gov/news", "ukraineinvest.gov.ua"],
  },
  {
    id: "EBRD_PROJECTS",
    code: "M3",
    name: "EBRD Projects",
    nameRu: "Проекты ЕБРР",
    group: "finance",
    weight: 11,
    searchQuery: `EBRD European Bank Reconstruction Development Ukraine new projects investment ${years} pipeline`,
    logic: "New multi-year EBRD investments signal long-horizon confidence in Ukraine's stability (+50 to +80). Suspension or delay of committed projects = negative (-30 to -50).",
    sources: ["ebrd.com/where-we-invest/ukraine"],
  },
  {
    id: "KIEL_TRACKER",
    code: "M4",
    name: "Kiel Ukraine Support Tracker",
    nameRu: "Трекер помощи Kiel",
    group: "finance",
    weight: 10,
    searchQuery: `Kiel Institute Ukraine Support Tracker military financial aid committed delivered ${years}`,
    logic: "Sustained or increasing committed aid suggests continued war posture (-20 to -40). Shift from military to reconstruction packages = strong positive (+40 to +70). Freezes or significant declines = ambiguous (0 to -20).",
    sources: ["kiel-institut.de Ukraine Support Tracker"],
  },
  {
    id: "PORTS_GRAIN",
    code: "M5",
    name: "Ports & Grain Corridor",
    nameRu: "Порты и зерновой коридор",
    group: "finance",
    weight: 10,
    searchQuery: `Ukraine Black Sea grain corridor ports exports shipping throughput maritime ${years} volume`,
    logic: "Expanding commercial shipping and grain exports = positive (+30 to +60). Blockade or severe disruption = strong negative (-60 to -90). Partial disruption = moderate negative (-20 to -40).",
    sources: ["apk-inform.com/en/news", "uspa.gov.ua"],
  },
  {
    id: "FOREIGN_INVESTORS",
    code: "M6",
    name: "Foreign Direct Investment Flows",
    nameRu: "Потоки иностранных инвестиций",
    group: "finance",
    weight: 11,
    searchQuery: `foreign direct investment Ukraine ${years} new companies entering market joint venture`,
    logic: "Entry of new foreign companies, joint ventures, or greenfield investments = very strong positive (+60 to +90). Mass exodus or suspension of operations = strong negative (-50 to -80).",
    sources: ["ukraineinvest.gov.ua", "Financial Times", "Reuters"],
  },

  // ===== Группа 2: Законодательство и Приватизация (Высокий вес) =====
  {
    id: "RADA_FDI",
    code: "M7",
    name: "Verkhovna Rada FDI Laws",
    nameRu: "Законы ВР по ПИИ",
    group: "law",
    weight: 11,
    searchQuery: `Ukraine parliament law investment business reform ${years}`,
    logic: "New laws easing foreign investor operations, concessions, or special economic zones = strong positive (+50 to +80). Laws restricting foreign ownership or nationalizing assets = strong negative (-40 to -70).",
    sources: ["rada.gov.ua/en/news"],
  },
  {
    id: "PROZORRO_PRIVAT",
    code: "M8",
    name: "Prozorro.Sale Large Privatization",
    nameRu: "Крупная приватизация Prozorro.Sale",
    group: "law",
    weight: 10,
    searchQuery: `Prozorro Sale Ukraine large privatization state assets tender auction ${years} successful`,
    logic: "Resumption of large privatization tenders = strong positive (+40 to +70). Cancellation or suspension = negative (-20 to -40). Foreign buyers winning tenders = very strong positive (+60 to +90).",
    sources: ["prozorro.sale API"],
  },
  {
    id: "EURLEX_EU",
    code: "M9",
    name: "EU Legislation (Eur-Lex)",
    nameRu: "Законодательство ЕС (Eur-Lex)",
    group: "law",
    weight: 9,
    searchQuery: `EUR-Lex European Union regulation Ukraine accession assistance fund reconstruction ${years}`,
    logic: "EU legal acts on Ukraine accession, assistance funds, reconstruction = positive (+30 to +60). Suspension or freezing of accession talks = negative (-30 to -50).",
    sources: ["eur-lex.europa.eu"],
  },
  {
    id: "CONCESSION_LAWS",
    code: "M10",
    name: "Concession & Infrastructure Laws",
    nameRu: "Законы о концессии и инфраструктуре",
    group: "law",
    weight: 9,
    searchQuery: `Ukraine infrastructure investment foreign company port airport railway management ${years}`,
    logic: "Laws transferring Ukrainian infrastructure (ports, airports, railways) to foreign concession = very strong positive (+50 to +80), as it implies long-term stability guarantees to investors.",
    sources: ["rada.gov.ua", "Ministry of Infrastructure Ukraine"],
  },

  // ===== Группа 3: Сигналы риска эскалации (Высокий вес, отрицательные) =====
  {
    id: "BELARUS_MOBIL",
    code: "M11",
    name: "Belarus Military Mobilization",
    nameRu: "Мобилизация/проверки ВУС в Беларуси",
    group: "escalation",
    weight: 10,
    searchQuery: `Belarus army military draft Lukashenko troops ${years}`,
    logic: "Mobilization, military registration checks, or troop movements in Belarus = strong negative (-60 to -90), as it signals potential new front opening. Return to normal civilian posture = positive (+20 to +40).",
    sources: ["belarus.by", "Radio Free Europe Belarus", "OSINT Belarus"],
  },
  {
    id: "ENERGY_INFRA",
    code: "M12",
    name: "Critical Energy Infrastructure Strikes",
    nameRu: "Удары по критической энергоинфраструктуре",
    group: "escalation",
    weight: 9,
    searchQuery: `Ukraine power grid energy infrastructure strike blackout electricity generation ${years} damage`,
    logic: "Massive strikes on energy infrastructure causing prolonged blackouts = strong negative (-50 to -80). Restoration and stabilization = positive (+20 to +40).",
    sources: ["Ukrenergo", "Reuters", "AP"],
  },
  {
    id: "UKR_POLAND_DEMARCHE",
    code: "M13",
    name: "Ukraine-Poland Diplomatic Demarches",
    nameRu: "Украинско-польские демарши",
    group: "escalation",
    weight: 6,
    searchQuery: `Ukraine Poland relations diplomatic dispute ${years}`,
    logic: "Diplomatic demarches, return of orders, public disputes = moderate negative (-15 to -30). Normalization and cooperation = positive (+10 to +20).",
    sources: ["Reuters", "AP", "Polish Foreign Ministry"],
  },
  {
    id: "ZELENSKY_THREATS",
    code: "M14",
    name: "Leadership Escalatory Rhetoric",
    nameRu: "Эскалаторная риторика лидеров",
    group: "escalation",
    weight: 5,
    searchQuery: `Zelensky threat warning Belarus Poland Lukashenko sharp statement escalation ${years}`,
    logic: "Direct threats or escalatory statements by Ukrainian leadership = moderate negative (-10 to -25). Conciliatory statements = positive (+5 to +15). Rhetoric without concrete action = limited impact.",
    sources: ["Reuters", "AP", "Ukrainian Presidential Office"],
  },
  {
    id: "RU_NUCLEAR_RHETORIC",
    code: "M15",
    name: "Russian Nuclear Rhetoric",
    nameRu: "Ядерная риторика РФ",
    group: "escalation",
    weight: 8,
    searchQuery: `Russia nuclear weapon rhetoric threat tactical nuclear red line Ukraine ${years}`,
    logic: "Explicit nuclear threats or nuclear exercises = strong negative (-70 to -90). De-escalation of nuclear rhetoric = positive (+10 to +30).",
    sources: ["kremlin.ru", "mid.ru", "Russian Ministry of Defense"],
  },

  // ===== Группа 4: Военные маркеры Украины (Средний вес) =====
  {
    id: "ISW_FRONTLINE",
    code: "M16",
    name: "Frontline Dynamics (ISW)",
    nameRu: "Динамика фронта (ISW)",
    group: "ukraine_military",
    weight: 6,
    searchQuery: `Institute for the Study of War ISW Ukraine frontline tactical assessment border ${years}`,
    logic: "Stable or contracting active front line = positive (+20 to +40). Major Russian advances or new breakthrough attempts = negative (-30 to -60).",
    sources: ["understandingwar.org"],
  },
  {
    id: "ACLED_INTENSITY",
    code: "M17",
    name: "Combat Intensity (ACLED)",
    nameRu: "Интенсивность боёв (ACLED)",
    group: "ukraine_military",
    weight: 6,
    searchQuery: `ACLED Ukraine conflict event data combat intensity casualties weekly ${years} report`,
    logic: "Declining weekly combat events and casualties = positive (+20 to +40). Sharp increase = negative (-30 to -50).",
    sources: ["acleddata.com (myACLED)"],
  },
  {
    id: "REAR_STRIKES_UA",
    code: "M18",
    name: "Rear Strikes (Ukraine)",
    nameRu: "Удары по тылу (Украина)",
    group: "ukraine_military",
    weight: 5,
    searchQuery: `Ukraine air alerts ballistic missile drone strike rear cities Kyiv Odesa Lviv ${years}`,
    logic: "Reduced frequency/duration of air alerts and rear strikes = positive (+15 to +30). A wave of strikes = negative (-40 to -60). A single strike causing mass casualties (dozens of reported deaths or injuries — e.g. a large-scale missile/drone attack on a major city like Kyiv) is a severe standalone signal = strong negative (-60 to -90), regardless of the broader weekly trend. Do not average a mass-casualty event down just because other days that week were calmer — treat it as the dominant fact for this marker.",
    sources: ["alerts.com.ua API"],
  },
  {
    id: "ORYX_LOSSES",
    code: "M19",
    name: "Equipment Losses (Oryx)",
    nameRu: "Потери техники (Oryx)",
    group: "ukraine_military",
    weight: 5,
    searchQuery: `Oryx Russia Ukraine equipment losses visually confirmed count tanks vehicles ${years} blog`,
    logic: "Sustained drop in visually confirmed losses = positive (+10 to +25). Sharp spike = negative (-20 to -40).",
    sources: ["github.com/leedrake5/russia-ukraine"],
  },

  // ===== Группа 5: Маркеры Российской стороны (Средний вес) =====
  {
    id: "RU_RHETORIC",
    code: "M20",
    name: "Russian Official Rhetoric",
    nameRu: "Официальная риторика РФ",
    group: "russia",
    weight: 5,
    searchQuery: `Kremlin Russia official statement Ukraine negotiations goals talks Lavrov Putin ${years}`,
    logic: "Shift to 'ready for negotiations' or 'seeking peace' = positive (+30 to +50). 'Goals of SMO will be achieved' or expansionist rhetoric = negative (-20 to -40).",
    sources: ["kremlin.ru", "mid.ru"],
  },
  {
    id: "RU_REAR_ECONOMY",
    code: "M21",
    name: "Russian Rear Strikes & Economy",
    nameRu: "Удары по тылу и экономика РФ",
    group: "russia",
    weight: 5,
    searchQuery: `Russia drone strike refinery oil facility economy sanctions budget deficit ${years} impact`,
    logic: "Strikes on Russian refineries and budget stress increase Moscow's incentive to negotiate = positive (+20 to +40). Russian economy resilience or war economy expansion = negative (-10 to -20).",
    sources: ["Reuters", "AP"],
  },
  {
    id: "RU_BUDGET_MOBIL",
    code: "M22",
    name: "Russian Budget/Mobilization",
    nameRu: "Бюджет/мобилизация РФ",
    group: "russia",
    weight: 6,
    searchQuery: `Russia state budget defense spending mobilization decree conscription Duma ${years} increase`,
    logic: "Surging defense budget and new mobilization = negative (-30 to -50). Freezes, reductions, or demobilization signals = positive (+30 to +60).",
    sources: ["OSINT Telegram", "State Duma news"],
  },

  // ===== Группа 6: Политика и Инфополе (Низкий вес) =====
  {
    id: "G7_WH_STATEMENTS",
    code: "M23",
    name: "G7 / White House Statements",
    nameRu: "Заявления G7 / Белого дома",
    group: "politics",
    weight: 3,
    searchQuery: `G7 White House statement Ukraine peace summit strategy support ${years} plan`,
    logic: "Concrete peace plans or summit proposals = positive (+15 to +30). Vague statements = minimal impact (+5 to +10).",
    sources: ["whitehouse.gov", "Reuters", "AP"],
  },
  {
    id: "OSINT_TELEGRAM",
    code: "M24",
    name: "OSINT Telegram Channels",
    nameRu: "OSINT Telegram-каналы",
    group: "politics",
    weight: 2,
    searchQuery: `Ukraine war analysis OSINT frontline map daily update ${years}`,
    logic: "Aggregate sentiment shift toward de-escalation = weak positive (+5 to +15). Widespread panic or escalation predictions = weak negative (-5 to -15). High noise, low signal — limited weight.",
    sources: ["Top-10 OSINT Telegram channels"],
  },
  {
    id: "MAJOR_DIPLOMATIC_SIGNALS",
    code: "M25",
    name: "Major Diplomatic & Third-Party Signals",
    nameRu: "Значимые дипломатические и внешние сигналы",
    group: "politics",
    weight: 3,
    searchQuery: `Ukraine war Russia diplomacy visit call talks leaders meeting ${years}`,
    logic: "Captures high-profile visits, leader-to-leader calls, and third-party (business, allied-state) engagement related to the war that narrower markers may miss (e.g. a foreign tech/defense executive visiting Kyiv, a call between two heads of state discussing the war). Direction depends strictly on content, assessed neutrally without moral judgment: engagement signaling openness to negotiation, reconstruction investment, or de-escalation = mild positive (+10 to +25); engagement reaffirming continued war posture or new military coordination = mild negative (-10 to -25). This marker exists primarily for situational completeness — given its low weight, it should not meaningfully swing the aggregate, but should surface notable facts in the UI so the index reflects awareness of major news even outside the 24 core markers.",
    sources: ["Reuters", "AP", "official statements"],
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
    escalation: [],
    ukraine_military: [],
    russia: [],
    politics: [],
  };
  for (const m of MARKERS) out[m.group].push(m);
  return out;
}
