import { db } from "@/lib/db";
import { llmComplete, sleep } from "@/lib/ai";
import { fetchGoogleNewsRSS, type NewsItem } from "@/lib/rss";
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

OUTPUT JSON SCHEMA:
{
  "probability": <int between -100 and 100>,
  "trend": "<UP|DOWN|FLAT>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "rationale_en": "<2-3 sentences explaining the logic, referencing specific events and scores>",
  "key_facts": [{"fact": "...", "url": "..."}]
}`;
}

export interface KeyFact {
  fact: string;
  url: string;
}

export interface MarkerAnalysis {
  probability: number;
  trend: Trend;
  confidence: Confidence;
  rationaleEn: string;
  keyFacts: KeyFact[];
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

  const news = await fetchGoogleNewsRSS(marker.searchQuery, 12);
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
    };
  }

  const userInput = `CURRENT_DATE: ${todayStr}
MARKER_ID: ${marker.id}
WEIGHT: ${marker.weight}
GROUP: ${marker.group}
MARKER_LOGIC: ${marker.logic}

${formatNewsData(news)}

QUESTION: Based on the news data above, estimate the Peace/Escalation score (from -100 to +100) for Ukraine within the next ${HORIZON_DAYS} days (horizon: ${todayStr} → ${addDaysStr(todayStr, HORIZON_DAYS)}), considering this marker's logic and group.

SCORING GUIDANCE:
- Finance/Law markers: Multi-year investments, insurance, privatization, concessions → +50 to +100
- Escalation markers: Mobilization, nuclear threats, infrastructure strikes → -50 to -100
- Military markers: Frontline stability → +20 to +40; major advances → -30 to -60
- Russia markers: Negotiation readiness → +30 to +50; mobilization → -30 to -50
- Politics markers: Concrete peace plans → +15 to +30; vague statements → ±5

When checking freshness: compare each news date to CURRENT_DATE (${todayStr}). News older than ${addDaysStr(todayStr, -STALE_THRESHOLD_DAYS)} is stale.

In "key_facts", you MUST include URLs from the INPUT_DATA above to verify claims. Do not invent URLs.

Return JSON only with this schema:
{
  "probability": <int between -100 and 100>,
  "trend": "<UP|DOWN|FLAT>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "rationale_en": "<2-3 sentences explaining the logic, referencing specific recent events and numerical score>",
  "key_facts": [{"fact": "...", "url": "..."}]
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
    };
  }

  let parsed: {
    probability?: number;
    trend?: string;
    confidence?: string;
    rationale_en?: string;
    key_facts?: { fact?: string; url?: string }[];
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

  return {
    probability: clamp(Math.round(Number(parsed.probability) || 0), -100, 100),
    trend,
    confidence: enforcedConfidence,
    rationaleEn: parsed.rationale_en?.trim() || "No rationale provided by the model.",
    keyFacts,
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

  let weightedSum = 0;
  let weightSum = 0;
  for (const s of scores) {
    weightedSum += s.weight * s.probability;
    weightSum += s.weight;
  }
  let total = weightSum > 0 ? weightedSum / weightSum : 0;

  // Симметричный штраф за LOW-confidence: тянет к 0 (нейтралитет)
  const heavyLow = scores.filter(
    (s) => s.weight > 8 && s.confidence === "LOW",
  ).length;

  const penalty = heavyLow * 4; // Уменьшили с 5 до 4, т.к. больше маркеров
  if (total > 0) {
    total = Math.max(0, total - penalty);
  } else if (total < 0) {
    total = Math.min(0, total + penalty);
  }

  total = clamp(Math.round(total), -100, 100);

  const todayStr = fmtDateISO(startOfTodayUTC());
  const markersBrief = scores
    .map(
      (s) =>
        `{"id":"${s.markerId}","weight":${s.weight},"score":${s.probability},"confidence":"${s.confidence}","rationale":"${s.rationaleEn.replace(/"/g, "'").slice(0, 140)}"}`,
    )
    .join(",\n");

  const aggPrompt = `You are the Aggregator for the Peace Index 180. Today is ${todayStr}. The final score stands deterministically at ${total}% (on a scale from -100% max escalation to +100% durable peace, where 0% is deadlock).

markers = [
${markersBrief}
]

Write an executive summary (exactly 3 sentences, in English) explaining WHY the index stands at ${total}% — name the 2-3 most influential positive or negative drivers. Use concrete examples from the markers' rationales.

INTERPRETATION GUIDE:
• +80 to +100: "Durable peace is becoming highly probable"
• +40 to +79: "Peace tendency is strengthening"
• -39 to +39: "Deadlock / frozen conflict persists"
• -40 to -79: "Escalation risks are rising"
• -80 to -100: "Severe escalation is imminent"

Be concrete, neutral, and data-driven. Do not include the JSON, just the prose summary.`;

  let summaryEn = "";
  try {
    summaryEn = (
  await llmCompleteText(
        `You write concise, neutral executive summaries for a peace/escalation index. Today's date: ${todayStr}. Scale: -100 (war) to +100 (peace).`,
        aggPrompt,
      )
    ).trim();
  } catch (err) {
    console.error("[analyzer] aggregate summary failed:", err);
    summaryEn = `Weighted average across ${scores.length} markers yields an index score of ${total}% (range -100% war to +100% peace) as of ${todayStr}.`;
  }

  return { totalProbability: total, summaryEn };
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
      rationaleRu: null,
    },
  });
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
      summaryRu: null,
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

  // Сортируем маркеры: сначала высоковесные (finance, law, escalation), потом остальные
  const sortedMarkers = [...MARKERS].sort((a, b) => b.weight - a.weight);

  const scores: {
    markerId: string;
    probability: number;
    confidence: Confidence;
    weight: number;
    rationaleEn: string;
  }[] = [];

  for (let i = 0; i < sortedMarkers.length; i++) {
    const m = sortedMarkers[i];
    onProgress?.({
      phase: "analyzing",
      current: `${m.code} · ${m.name}`,
      idx: i,
      total: sortedMarkers.length,
    });

    const analysis = await analyzeMarker(m);
    await saveMarkerScore(calcDate, m, analysis);

    scores.push({
      markerId: m.id,
      probability: analysis.probability,
      confidence: analysis.confidence,
      weight: m.weight,
      rationaleEn: analysis.rationaleEn,
    });

    await sleep(5000);
  }

  onProgress?.({
    phase: "aggregating",
    current: "Aggregating final index",
    idx: sortedMarkers.length,
    total: sortedMarkers.length,
  });
  const aggregate = await calculateAggregate(scores);
  // В calculateAggregate, перед сохранением:
  await saveAggregate(calcDate, aggregate, scores.length);

  onProgress?.({
    phase: "done",
    current: "Complete",
    idx: sortedMarkers.length,
    total: sortedMarkers.length,
  });

  return aggregate;
}

export async function translateToRussian(text: string): Promise<string> {
  const result = await llmComplete(
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
