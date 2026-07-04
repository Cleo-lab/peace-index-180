import { db } from "@/lib/db";
import { llmComplete, llmCompleteText, sleep } from "@/lib/ai";
import { fetchNews, type NewsItem } from "@/lib/rss";
import { getRecentEvents } from "@/lib/collector";
import {
  MARKERS,
  MARKER_MAP,
  TOTAL_WEIGHT,
  type Confidence,
  type MarkerDef,
  type Trend,
} from "@/lib/markers";

const HORIZON_DAYS = 180;
const STALE_THRESHOLD_DAYS = 14;

function buildSystemInstruction(currentDateStr: string): string {
  return `You are an analytical engine estimating the Peace & Escalation Index for Ukraine within the next ${HORIZON_DAYS} days.
Your output MUST be strict JSON without markdown formatting.

CURRENT_DATE (today): ${currentDateStr}
ANALYSIS_HORIZON: ${currentDateStr} → ${addDaysStr(currentDateStr, HORIZON_DAYS)} (${HORIZON_DAYS} days)
NEUTRALITY:
- This index does not take sides and does not assign moral, legal, or ethical judgment to any party's actions.
- Assess only observable, verifiable facts and their plausible bearing on the likelihood of peace or escalation within the horizon.
- Describe statements and actions by any leader or party in neutral, factual language, without editorializing.

SCALE DEFINITION (-100 to +100):
• +100 = Guaranteed durable peace: signed treaties, massive foreign reconstruction investments ($50B+), demilitarized zones, full prisoner exchanges.
• +60 to +99 = Strong peace signals: new long-term insurance policies, large privatization to foreign investors, EU accession progress, IMF reviews completed.
• +20 to +59 = Moderate peace tendency: grain corridor expansion, diplomatic statements, reduced combat intensity.
• -19 to +19 = Frozen conflict / deadlock: no significant movement, balanced positive and negative signals.
• -20 to -59 = Escalation tendency: increased mobilization, diplomatic demarches, energy infrastructure strikes, rhetoric sharpening.
• -60 to -99 = Strong escalation signals: Belarus military mobilization, nuclear threats, new front openings, mass civilian evacuation.
• -100 = Total war escalation: Belarus enters war, tactical nuclear use, full mobilization, collapse of diplomatic channels.

RULES:
1. Base your score (integer from -100 to 100) ONLY on the provided INPUT_DATA.
2. Economic, financial, concession, and privatization signals carry the HIGHEST weight toward positive scores.
3. Military mobilization (especially Belarus), nuclear rhetoric, energy infrastructure destruction, and diplomatic demarches carry HIGH weight toward negative scores.
4. Pure political statements WITHOUT concrete action carry LOW weight in either direction.
5. Do not invent facts. In "key_facts", you MUST include URLs from INPUT_DATA to verify claims.
6. If the latest event in INPUT_DATA is older than ${STALE_THRESHOLD_DAYS} days from CURRENT_DATE, set confidence to "LOW" and bias toward 0 (uncertainty).
7. When multiple contradictory signals exist, weight financial/investment signals higher than political rhetoric.
8. If INPUT_DATA contains multiple reports of similar or recurring events (e.g., repeated strikes on the same target type) at different dates, always center your rationale and score on the MOST RECENT occurrence. Do not describe or score based on an older event as if it were the latest development, even if it appears more prominently or repeatedly in the list.

ENTITY COMMITMENT TRACKING (relevant mainly to finance/law markers):
- If INPUT_DATA names a specific institutional actor (an investment fund, bank, insurer, government agency, or legislative body) making or updating a concrete financial or legal commitment (an investment amount, guarantee, law, tender outcome), add one entry per such actor to "entity_updates".
- If PREVIOUSLY RECORDED COMMITMENTS are provided below, compare the current claim against the most recent one for the same actor and set "stance" accordingly: NEW (first time seen), REAFFIRMED (same commitment restated), INCREASED, REDUCED, or WITHDRAWN.
- A REDUCED or WITHDRAWN commitment is a meaningful negative signal for this marker's score even if the underlying activity has not fully stopped — it reflects reduced confidence, and your probability score should account for it.
- Leave "entity_updates" as an empty array if no specific institutional actor with a concrete commitment is mentioned. Do not invent entities, amounts, or dates.

OUTPUT JSON SCHEMA:
{
  "probability": <int between -100 and 100>,
  "trend": "<UP|DOWN|FLAT>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "rationale_en": "<2-3 sentences explaining the logic, referencing specific events and scores>",
  "key_facts": [{"fact": "...", "url": "..."}],
  "entity_updates": [{"entity_name": "...", "stance": "<NEW|REAFFIRMED|INCREASED|REDUCED|WITHDRAWN>", "claim_summary": "...", "claim_date": "<YYYY-MM-DD>", "url": "..."}]
}`;
}

export interface KeyFact {
  fact: string;
  url: string;
}

export type EntityStance = "NEW" | "REAFFIRMED" | "INCREASED" | "REDUCED" | "WITHDRAWN";

export interface EntityUpdate {
  entityName: string;
  stance: EntityStance;
  claimSummary: string;
  claimDate: string; // ISO YYYY-MM-DD, как вернула модель
  url: string;
}

/// Группы маркеров, для которых имеет смысл отслеживать позиции институциональных
/// игроков во времени — структурные, долгоиграющие сигналы (инвесторы, страховщики,
/// законодатели). Эскалационные/военные/политические маркеры это поле не используют.
const ENTITY_TRACKED_GROUPS = new Set(["finance", "law"]);

export interface MarkerAnalysis {
  probability: number;
  trend: Trend;
  confidence: Confidence;
  rationaleEn: string;
  keyFacts: KeyFact[];
  entityUpdates: EntityUpdate[];
}

export interface AggregateResult {
  totalProbability: number;
  summaryEn: string;
}

function fmtDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return fmtDateISO(d);
}

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  return JSON.parse(text);
}

function clamp(n: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/// Форматирует последние зафиксированные позиции институциональных игроков для
/// вставки в промпт — модель сравнивает новые новости с этим списком.
function formatEntityCommitments(
  rows: { entityName: string; claimSummary: string; claimDate: Date; stance: string }[],
): string {
  if (rows.length === 0) {
    return "PREVIOUSLY RECORDED COMMITMENTS: none on record yet for this marker.";
  }
  const lines = rows.map((r) => {
    const d = r.claimDate.toISOString().slice(0, 10);
    return `- [${d}] ${r.entityName}: ${r.claimSummary} (last known stance: ${r.stance})`;
  });
  return `PREVIOUSLY RECORDED COMMITMENTS (most recent first):\n${lines.join("\n")}`;
}

function formatNewsData(news: NewsItem[]): string {
  if (news.length === 0) {
    return "INPUT_DATA (recent news): (no recent news found via Google News RSS)";
  }
  const lines = news.map((n) => {
    const d = n.date.toISOString().slice(0, 10);
    return `- ${d}: ${n.title} [${n.source}] Source: ${n.url}`;
  });
  return `INPUT_DATA (recent news from Google News RSS):\n${lines.join("\n")}`;
}

/// Fallback score based on marker group when no news available
function getGroupFallbackScore(group: string): number {
  switch (group) {
    case "finance":
      return 5; // Slight positive bias — financial markets tend toward stability
    case "law":
      return 5; // Legislative processes continue even during war
    case "escalation":
      return -5; // Slight negative bias — absence of news doesn't mean absence of risk
    case "ukraine_military":
      return -3; // Military situation tends to deteriorate without active diplomacy
    case "russia":
      return -2; // Russian posture generally hostile
    case "politics":
      return 0; // Pure politics is noise
    default:
      return 0;
  }
}
// В analyzer.ts — добавить функцию очистки:

function cleanRationale(text: string): string {
  if (!text) return "";
  
  // Если это JSON — извлекаем rationale_en
  try {
    const parsed = JSON.parse(text);
    if (parsed.rationale_en) return parsed.rationale_en;
    if (parsed.rationale_ru) return parsed.rationale_ru;
  } catch {
    // Не JSON — оставляем как есть
  }
  
  return text;
}

export async function analyzeMarker(marker: MarkerDef): Promise<MarkerAnalysis> {
  const today = startOfTodayUTC();
  const todayStr = fmtDateISO(today);

  // Эскалационным/военным/российским маркерам нужны СЕГОДНЯШНИЕ данные — короткое окно
  // свежести (7 дней) не даёт недельной давности статье вытеснить сегодняшнюю в выдаче.
  // Структурным (finance/law/politics) маркерам старые данные всё ещё релевантны —
  // окно шире (30 дней), это соответствует принципу "решение инвестора не устаревает
  // за неделю", который мы закладывали в отслеживание сущностей.
  const RECENCY_SENSITIVE_GROUPS = new Set(["escalation", "ukraine_military", "russia"]);
  const daysWindow = RECENCY_SENSITIVE_GROUPS.has(marker.group) ? 7 : 30;

  let news = await fetchNews(marker.searchQuery, 18, daysWindow);

// Fallback: если Google News пуст, берём из БД за последние 7 дней
if (news.length === 0) {
  const recentFromDb = await getRecentEvents(marker.id, 7);
  if (recentFromDb.length > 0) {
    console.log(`[analyzer] ${marker.id}: fallback to ${recentFromDb.length} DB events`);
    news = recentFromDb.map(e => ({
      title: e.rawText.slice(0, 120),
      url: e.sourceUrl,
      date: e.eventDate,
      source: e.sourceName,
      snippet: e.rawText,
      relevance: e.relevance,
    }));
  }
}
  console.log(`[analyzer] ${marker.id}: collected ${news.length} news items`);

  if (news.length === 0) {
    console.warn(`[analyzer] ${marker.id}: нет новостей — пропускаем LLM, возвращаем LOW-confidence заглушку`);
    const fallback = getGroupFallbackScore(marker.group);
    return {
      probability: fallback,
      trend: "FLAT",
      confidence: "LOW",
      rationaleEn:
        `No recent news found for this marker via Google News RSS. ` +
        `A neutral low-confidence estimate (${fallback > 0 ? "+" : ""}${fallback}) is applied based on the marker's group baseline; ` +
        `this marker carries reduced weight in today's aggregate.`,
      keyFacts: [],
      entityUpdates: [],
    };
  }

  // Для структурных маркеров (finance/law) подтягиваем последние зафиксированные
  // позиции институциональных игроков — модель сравнит новые новости с ними и
  // отличит "подтверждение" от "пересмотра вниз/отзыва".
  const tracksEntities = ENTITY_TRACKED_GROUPS.has(marker.group);
  let entityContext = "";
  if (tracksEntities) {
    try {
      const recentCommitments = await db.entityCommitment.findMany({
        where: { markerId: marker.id },
        orderBy: { claimDate: "desc" },
        take: 5,
      });
      entityContext = formatEntityCommitments(recentCommitments);
    } catch (err) {
      console.error(`[analyzer] failed to load entity commitments for ${marker.id}:`, err);
      entityContext = "PREVIOUSLY RECORDED COMMITMENTS: unavailable (lookup failed).";
    }
  }

  const userInput = `CURRENT_DATE: ${todayStr}
MARKER_ID: ${marker.id}
WEIGHT: ${marker.weight}
GROUP: ${marker.group}
MARKER_LOGIC: ${marker.logic}

${formatNewsData(news)}
${tracksEntities ? `\n${entityContext}\n` : ""}
QUESTION: Based on the news data above, estimate the Peace/Escalation score (from -100 to +100) for Ukraine within the next ${HORIZON_DAYS} days (horizon: ${todayStr} → ${addDaysStr(todayStr, HORIZON_DAYS)}), considering this marker's logic and group.

SCORING GUIDANCE:
- Finance/Law markers: Multi-year investments, insurance, privatization, concessions → +50 to +100
- Escalation markers: Mobilization, nuclear threats, infrastructure strikes → -50 to -100
- Military markers: Frontline stability → +20 to +40; major advances → -30 to -60
- Russia markers: Negotiation readiness → +30 to +50; mobilization → -30 to -50
- Politics markers: Concrete peace plans → +15 to +30; vague statements → ±5

When checking freshness: compare each news date to CURRENT_DATE (${todayStr}). News older than ${addDaysStr(todayStr, -STALE_THRESHOLD_DAYS)} is stale.

In "key_facts", you MUST include URLs from the INPUT_DATA above to verify claims. Do not invent URLs.
${tracksEntities ? `\nIf a specific institutional actor (fund, bank, insurer, agency, legislature) makes or updates a concrete commitment, populate "entity_updates" — compare against PREVIOUSLY RECORDED COMMITMENTS above and set the correct stance. Otherwise leave it empty.\n` : ""}
Return JSON only with this schema:
{
  "probability": <int between -100 and 100>,
  "trend": "<UP|DOWN|FLAT>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "rationale_en": "<2-3 sentences explaining the logic, referencing specific recent events and numerical score>",
  "key_facts": [{"fact": "...", "url": "..."}],
  "entity_updates": [{"entity_name": "...", "stance": "<NEW|REAFFIRMED|INCREASED|REDUCED|WITHDRAWN>", "claim_summary": "...", "claim_date": "<YYYY-MM-DD>", "url": "..."}]
}`;

  let raw = "";
  try {
    raw = await llmComplete(buildSystemInstruction(todayStr), userInput);
  } catch (err) {
    console.error(`[analyzer] LLM call failed for ${marker.id}:`, err);
    const fallback = getGroupFallbackScore(marker.group);
    return {
      probability: fallback,
      trend: "FLAT",
      confidence: "LOW",
      rationaleEn: `Analysis unavailable due to a model error. Fallback estimate (${fallback > 0 ? "+" : ""}${fallback}) applied based on marker group baseline.`,
      keyFacts: [],
      entityUpdates: [],
    };
  }

  let parsed: {
    probability?: number;
    trend?: string;
    confidence?: string;
    rationale_en?: string;
    key_facts?: { fact?: string; url?: string }[];
    entity_updates?: { entity_name?: string; stance?: string; claim_summary?: string; claim_date?: string; url?: string }[];
  };
  try {
    parsed = extractJson(raw) as typeof parsed;
  } catch {
    console.error(`[analyzer] JSON parse failed for ${marker.id}:`, raw.slice(0, 300));
    const fallback = getGroupFallbackScore(marker.group);
    return {
      probability: fallback,
      trend: "FLAT",
      confidence: "LOW",
      rationaleEn: "The model returned a non-JSON response; fallback estimate applied.",
      keyFacts: [],
      entityUpdates: [],
    };
  }

  const newsCount = news.length;
  let enforcedConfidence: Confidence;
  const modelConf = (parsed.confidence ?? "MEDIUM").toUpperCase();
  if (newsCount >= 8) {
    enforcedConfidence = modelConf === "HIGH" || modelConf === "LOW" ? (modelConf as Confidence) : "MEDIUM";
  } else if (newsCount >= 3) {
    enforcedConfidence = modelConf === "LOW" ? "LOW" : "MEDIUM";
  } else {
    enforcedConfidence = "LOW";
  }

  const allowedUrls = new Set(news.map((n) => n.url));
  let keyFacts: KeyFact[] = (parsed.key_facts ?? [])
    .filter((f) => f.fact && f.url && allowedUrls.has(f.url))
    .map((f) => ({ fact: f.fact!, url: f.url! }));

  if (keyFacts.length === 0 && news.length > 0) {
    keyFacts = news.slice(0, 5).map((n) => ({
      fact: n.title,
      url: n.url,
    }));
  }

  const trend = (["UP", "DOWN", "FLAT"].includes((parsed.trend ?? "").toUpperCase())
    ? (parsed.trend as string).toUpperCase()
    : "FLAT") as Trend;

  // Та же анти-галлюцинационная проверка, что и для key_facts: URL обязан быть
  // из реально предоставленных новостей, иначе запись отбрасывается.
  const VALID_STANCES = new Set(["NEW", "REAFFIRMED", "INCREASED", "REDUCED", "WITHDRAWN"]);
  const entityUpdates: EntityUpdate[] = tracksEntities
    ? (parsed.entity_updates ?? [])
        .filter(
          (u) =>
            u.entity_name &&
            u.stance &&
            VALID_STANCES.has(u.stance.toUpperCase()) &&
            u.claim_summary &&
            u.claim_date &&
            u.url &&
            allowedUrls.has(u.url),
        )
        .map((u) => ({
          entityName: u.entity_name!.trim(),
          stance: u.stance!.toUpperCase() as EntityStance,
          claimSummary: u.claim_summary!.trim(),
          claimDate: u.claim_date!,
          url: u.url!,
        }))
    : [];

  return {
    probability: clamp(Math.round(Number(parsed.probability) || 0), -100, 100),
    trend,
    confidence: enforcedConfidence,
    rationaleEn: parsed.rationale_en?.trim() || "No rationale provided by the model.",
    keyFacts,
    entityUpdates,
  };
}

export async function calculateAggregate(
  scores: {
    markerId: string;
    probability: number;
    confidence: Confidence;
    weight: number;
    rationaleEn: string;
  }[],
): Promise<AggregateResult> {
  if (scores.length === 0) {
    return { totalProbability: 0, summaryEn: "No marker data available." };
  }

  // === Подсчёт заглушек (маркеров без каких-либо новостей вообще) ===
  const isStub = (s: (typeof scores)[number]) =>
    s.confidence === "LOW" && s.rationaleEn.includes("No recent news");

  const stubCount = scores.filter(isStub).length;
  const coveragePercent = Math.round(((scores.length - stubCount) / scores.length) * 100);

  // === Вычисление взвешенного среднего с учётом надёжности маркера ===
  // Было: плоский штраф "-4 очка к итогу за каждый тяжёлый (weight>8) LOW-маркер",
  // применявшийся ПОСЛЕ расчёта и механически тянувший индекс к нулю.
  // Стало: эффективный вес маркера пропорционально снижается по confidence
  // ДО усреднения. Заглушки (нет новостей вообще) исключаются из суммы весов
  // полностью — больше не размывают среднее фейковым fallback-значением.
  const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
    HIGH: 1.0,
    MEDIUM: 1.0,
    LOW: 0.5,
  };

  let weightedSum = 0;
  let weightSum = 0;
  let rawWeightedSum = 0;
  let rawWeightSum = 0;

  for (const s of scores) {
    rawWeightedSum += s.weight * s.probability;
    rawWeightSum += s.weight;

    const multiplier = isStub(s) ? 0 : CONFIDENCE_MULTIPLIER[s.confidence];
    const effectiveWeight = s.weight * multiplier;
    weightedSum += effectiveWeight * s.probability;
    weightSum += effectiveWeight;
  }

  // Защита от вырожденного случая: если ВСЕ маркеры — заглушки (весь сбор
  // данных за день не удался), не роняем индекс в 0 молча, а откатываемся
  // на сырое среднее, чтобы не потерять сигнал полностью.
  let total: number;
  if (weightSum > 0) {
    total = weightedSum / weightSum;
  } else if (rawWeightSum > 0) {
    console.warn("[analyzer] all markers are stubs — falling back to raw weighted average");
    total = rawWeightedSum / rawWeightSum;
  } else {
    total = 0;
  }
  total = clamp(Math.round(total), -100, 100);

  const rawTotal =
    rawWeightSum > 0 ? clamp(Math.round(rawWeightedSum / rawWeightSum), -100, 100) : 0;

  console.log(
    `[analyzer] aggregate: raw=${rawTotal}, confidence-adjusted=${total}, ` +
      `coverage=${coveragePercent}% (${scores.length - stubCount}/${scores.length} markers with real data), ` +
      `effective weight used=${Math.round(weightSum)}/${Math.round(rawWeightSum)}`,
  );

  const todayStr = fmtDateISO(startOfTodayUTC());
  const markersBrief = scores
    .map(
      (s) =>
        `{"id":"${s.markerId}","weight":${s.weight},"score":${s.probability},"confidence":"${s.confidence}","rationale":"${s.rationaleEn.replace(/"/g, "'").slice(0, 220)}"}`,
    )
    .join(",\n");

    // Добавляем warning если много заглушек
  const coverageWarning = stubCount > 3 
    ? `NOTE: ${stubCount} of ${scores.length} markers returned low-confidence estimates due to lack of recent news data. The index may be less reliable than usual. `
    : "";

  const aggPrompt = `You are the Aggregator for the Peace Index 180. Today is ${todayStr}. The final score stands deterministically at ${total} (on a scale from -100 max escalation to +100 durable peace, where 0 is deadlock).

${coverageWarning}Data coverage: ${coveragePercent} of markers have sufficient news-based confidence.

markers = [
${markersBrief}
]

Write an executive summary (3-4 sentences, in English) explaining WHY the index stands at ${total}:
1. In 1-2 sentences, name the 2-3 most statistically influential drivers (highest weight × score contribution). Use concrete examples from the markers' rationales.
2. Then, separately, scan ALL markers' rationales above — regardless of their weight — for any mention of a large-scale, high-casualty single event within the last few days (e.g. a mass-casualty missile/drone strike on a city, a major escalation incident with significant reported deaths or injuries). If such an event is mentioned anywhere, add one factual, neutral sentence acknowledging it, even if that marker's weight is too low to be a statistical driver — this keeps the summary reflecting real-world events the reader would expect to see, not only the weighted math. If no such standout event appears in any marker's rationale, omit this sentence entirely — do not invent one.

INTERPRETATION GUIDE:
• +80 to +100: "Durable peace is becoming highly probable"
• +40 to +79: "Peace tendency is strengthening"
• -39 to +39: "Deadlock / frozen conflict persists"
• -40 to -79: "Escalation risks are rising"
• -80 to -100: "Severe escalation is imminent"

Be concrete, neutral, and data-driven. Do not include the JSON, just the prose summary.`;

  const summaryResult = await generateSummary(todayStr, aggPrompt, scores.length, total);

  return { totalProbability: total, summaryEn: summaryResult };
}

// Workaround для бага Bun #13208: let + await в одном блоке async-функции
async function generateSummary(
  todayStr: string,
  aggPrompt: string,
  scoreCount: number,
  total: number,
): Promise<string> {
  try {
    const text = await llmCompleteText(
      `You write concise, neutral executive summaries for a peace/escalation index. Today's date: ${todayStr}. Scale: -100 (war) to +100 (peace).`,
      aggPrompt,
    );
    return text.trim();
  } catch (err) {
    console.error("[analyzer] aggregate summary failed:", err);
    return `Weighted average across ${scoreCount} markers yields an index score of ${total} (range -100 war to +100 peace) as of ${todayStr}.`;
  }
}
export async function saveMarkerScore(
  calcDate: Date,
  marker: MarkerDef,
  analysis: MarkerAnalysis,
): Promise<void> {
  await db.markerScore.upsert({
    where: {
      calcDate_markerId: {
        calcDate,
        markerId: marker.id,
      },
    },
    create: {
      calcDate,
      markerId: marker.id,
      probability: analysis.probability,
      trend: analysis.trend,
      confidence: analysis.confidence,
      rationaleEn: analysis.rationaleEn,
      keyFactsJson: JSON.stringify(analysis.keyFacts),
      weight: marker.weight,
    },
    update: {
      probability: analysis.probability,
      trend: analysis.trend,
      confidence: analysis.confidence,
      rationaleEn: analysis.rationaleEn,
      keyFactsJson: JSON.stringify(analysis.keyFacts),
      weight: marker.weight,
    },
  });
}

/// Сохраняет/обновляет зафиксированные позиции институциональных игроков по маркеру.
/// Один и тот же (markerId, sourceUrl, entityName) не дублируется — upsert.
/// Ошибка по одной записи не должна ронять весь прогон — try/catch на каждую.
export async function saveEntityCommitments(
  calcDate: Date,
  marker: MarkerDef,
  updates: EntityUpdate[],
): Promise<void> {
  for (const u of updates) {
    const parsedDate = new Date(u.claimDate);
    const claimDate = isNaN(parsedDate.getTime()) ? calcDate : parsedDate;
    try {
      await db.entityCommitment.upsert({
        where: {
          markerId_sourceUrl_entityName: {
            markerId: marker.id,
            sourceUrl: u.url,
            entityName: u.entityName,
          },
        },
        create: {
          markerId: marker.id,
          entityName: u.entityName,
          stance: u.stance,
          claimSummary: u.claimSummary,
          claimDate,
          sourceUrl: u.url,
          calcDate,
        },
        update: {
          stance: u.stance,
          claimSummary: u.claimSummary,
          claimDate,
          calcDate,
        },
      });
    } catch (err) {
      console.error(
        `[analyzer] failed to save entity commitment for ${marker.id}/${u.entityName}:`,
        err,
      );
    }
  }
}

export async function saveAggregate(
  calcDate: Date,
  result: AggregateResult,
  markerCount: number,
): Promise<void> {
  await db.aggregate.upsert({
    where: { calcDate },
    create: {
      calcDate,
      totalProbability: result.totalProbability,
      summaryEn: result.summaryEn,
      markerCount,
    },
    update: {
      totalProbability: result.totalProbability,
      summaryEn: result.summaryEn,
      markerCount,
    },
  });
}

export interface RunProgress {
  phase: "analyzing" | "aggregating" | "done" | "error";
  current: string;
  idx: number;
  total: number;
}

export async function runFullAnalysis(
  onProgress?: (p: RunProgress) => void,
): Promise<AggregateResult> {
  const calcDate = startOfTodayUTC();
  const sortedMarkers = [...MARKERS].sort((a, b) => b.weight - a.weight);

  const scores: {
    markerId: string;
    probability: number;
    confidence: Confidence;
    weight: number;
    rationaleEn: string;
  }[] = [];

  // ===== Этап 1: анализ всех маркеров =====
  for (let i = 0; i < sortedMarkers.length; i++) {
    const marker = sortedMarkers[i];
    onProgress?.({
      phase: "analyzing",
      current: marker.id,
      idx: i,
      total: sortedMarkers.length,
    });

    const analysis = await analyzeMarker(marker);
    scores.push({
      markerId: marker.id,
      probability: analysis.probability,
      confidence: analysis.confidence,
      weight: marker.weight,
      rationaleEn: analysis.rationaleEn,
    });
    await saveMarkerScore(calcDate, marker, analysis);
    if (analysis.entityUpdates.length > 0) {
      await saveEntityCommitments(calcDate, marker, analysis.entityUpdates);
    }
  }

  // ===== Этап 2: агрегация =====
  onProgress?.({
    phase: "aggregating",
    current: "Aggregating final index",
    idx: sortedMarkers.length,
    total: sortedMarkers.length,
  });
  const aggregate = await calculateAggregate(scores);
  await saveAggregate(calcDate, aggregate, scores.length);

  // ===== Этап 3: пакетный перевод rationale маркеров =====
  onProgress?.({
    phase: "aggregating",
    current: `Batch translating ${scores.length} markers`,
    idx: sortedMarkers.length,
    total: sortedMarkers.length,
  });

  const payloadItems = scores
    .map((s) => `  "${s.markerId}": ${JSON.stringify(s.rationaleEn)}`)
    .join(",\n");

  const batchPrompt = `Translate the following English texts into natural, accurate Russian. Preserve meaning, neutrality, and any URLs. Return ONLY a valid JSON object where keys are marker IDs and values are Russian translations.

{
${payloadItems}
}`;

  try {
    const raw = await llmCompleteText(
      "You are a professional translator. Translate to Russian accurately. Return only valid JSON with the same keys as input.",
      batchPrompt,
    );

    const cleaned = raw
      .trim()
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, string>;

    // Сохраняем все переводы одним циклом (параллельно)
    await Promise.all(
      scores.map((s) => {
        const ru = parsed[s.markerId];
        if (ru) {
          return db.markerScore.update({
            where: { calcDate_markerId: { calcDate, markerId: s.markerId } },
            data: { rationaleRu: ru },
          });
        }
        return Promise.resolve();
      })
    );

    console.log(`[analyzer] Batch translated ${Object.keys(parsed).length}/${scores.length} markers`);
  } catch (err) {
    console.error("[analyzer] Batch translation failed:", err);
    // Fallback: последовательный перевод с задержкой
    for (const s of scores) {
      try {
        await sleep(4000);
        const ru = await translateToRussian(s.rationaleEn);
        await db.markerScore.update({
          where: { calcDate_markerId: { calcDate, markerId: s.markerId } },
          data: { rationaleRu: ru },
        });
      } catch (e) {
        console.error(`[analyzer] Fallback translation failed for ${s.markerId}:`, e);
      }
    }
  }

  // ===== Этап 4: перевод summary =====
  onProgress?.({
    phase: "aggregating",
    current: "Translating summary to Russian",
    idx: sortedMarkers.length,
    total: sortedMarkers.length,
  });

  try {
    const summaryRu = await translateToRussian(aggregate.summaryEn);
    await db.aggregate.update({
      where: { calcDate },
      data: { summaryRu },
    });
  } catch (err) {
    console.error("[analyzer] Failed to translate aggregate summary:", err);
  }

  onProgress?.({
    phase: "done",
    current: "Complete",
    idx: sortedMarkers.length,
    total: sortedMarkers.length,
  });

  return aggregate;
}
export async function translateToRussian(text: string): Promise<string> {
  // ВАЖНО: llmCompleteText вместо llmComplete.
  // llmComplete форсирует responseMimeType:"application/json" и MARKER_RESPONSE_SCHEMA —
  // Gemini возвращает JSON вместо русского текста, который и отображался в UI.
  const result = await llmCompleteText(
    "You are a professional translator. Translate the user's text into natural, accurate Russian. Preserve meaning, neutrality, and any URLs. Return ONLY the translation, no commentary.",
    text,
  );
  return result.trim();
}

export function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function totalWeightOf(markers: MarkerDef[]): number {
  return markers.reduce((s, m) => s + m.weight, 0);
}

export { MARKER_MAP, TOTAL_WEIGHT };
