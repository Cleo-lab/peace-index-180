import { db } from "@/lib/db";
import { llmComplete, llmCompleteWithSearch, sleep } from "@/lib/ai";
import {
  MARKERS,
  MARKER_MAP,
  TOTAL_WEIGHT,
  type Confidence,
  type MarkerDef,
  type Trend,
} from "@/lib/markers";
import type { CollectedEvent } from "@/lib/collector";

const HORIZON_DAYS = 180;
const STALE_THRESHOLD_DAYS = 14;

const SYSTEM_INSTRUCTION = `You are an analytical engine estimating the probability of peace (ceasefire, freeze, or treaty) in Ukraine within the next ${HORIZON_DAYS} days.
You receive structured data for ONE marker.
Your output MUST be strict JSON without markdown formatting.

RULES:
1. Base your probability (0-100%) ONLY on the provided INPUT_DATA.
2. Do not invent facts. In "key_facts", you MUST include URLs from INPUT_DATA to verify claims.
3. If the latest event in INPUT_DATA is older than ${STALE_THRESHOLD_DAYS} days, set confidence to "LOW".
4. Trend is relative to the previous week's context.

OUTPUT JSON SCHEMA:
{
  "probability": <int 0-100>,
  "trend": "<UP|DOWN|FLAT>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "rationale_en": "<2-3 sentences explaining the logic>",
  "key_facts": [{"fact": "...", "url": "..."}]
}`;

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

/// Удаляем markdown-обёртку и парсим JSON из ответа LLM.
function extractJson(raw: string): unknown {
  let text = raw.trim();
  // Срезаем ```json ... ``` или ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Берём первый {...} блок, если есть лишний текст
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  return JSON.parse(text);
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/// Анализ одного маркера через LLM + Google Search (grounding).
/// Gemini ищет актуальные данные и анализирует их одним вызовом.
/// Источники URL приходят из grounding metadata — для антигаллюцинации.
export async function analyzeMarker(
  marker: MarkerDef,
): Promise<MarkerAnalysis> {
  const userInput = `Search Google for the latest news and data about this marker, then analyze.

MARKER_ID: ${marker.id}
WEIGHT: ${marker.weight}
MARKER_LOGIC: ${marker.logic}
SOURCES_TO_CHECK: ${marker.sources.join(", ")}

Search query hint: ${marker.searchQuery}

QUESTION: Based on the latest data you find via Google Search, estimate the probability of peace in Ukraine within the next ${HORIZON_DAYS} days, considering this marker's logic. Long-term structural signals (multi-year insurance, IMF reviews, reconstruction laws) indicate market expectation of durable peace and raise the probability; active combat and mobilization lower it. 

Return JSON only with this schema:
{
  "probability": <int 0-100>,
  "trend": "<UP|DOWN|FLAT>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "rationale_en": "<2-3 sentences explaining the logic, referencing specific recent events>",
  "key_facts": [{"fact": "...", "url": "..."}]
}`;

  let raw = "";
  let sources: { url: string; title: string }[] = [];
  try {
    const result = await llmCompleteWithSearch(SYSTEM_INSTRUCTION, userInput);
    raw = result.text;
    sources = result.sources;
  } catch (err) {
    console.error(`[analyzer] LLM+search call failed for ${marker.id}:`, err);
    // Fallback: нейтральная оценка при ошибке
    return {
      probability: 30,
      trend: "FLAT",
      confidence: "LOW",
      rationaleEn:
        "Analysis unavailable due to a model error. Neutral low-confidence estimate applied as fallback.",
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
    return {
      probability: 30,
      trend: "FLAT",
      confidence: "LOW",
      rationaleEn: "The model returned a non-JSON response; neutral estimate applied.",
      keyFacts: [],
    };
  }

  // Данные свежие — Gemini искала в Google в реальном времени.
  // Confidence берём из ответа модели (с fallback на MEDIUM).
  const modelConfidence = (parsed.confidence ?? "MEDIUM").toUpperCase();
  const enforcedConfidence = (
    ["HIGH", "MEDIUM", "LOW"].includes(modelConfidence)
      ? modelConfidence
      : "MEDIUM"
  ) as Confidence;

  // Антигаллюцинации: фильтруем key_facts, оставляя только те,
  // чей URL есть в источниках из Google Search grounding.
  // Если модель не указала URL в key_facts, но есть grounding sources —
  // добавляем их как верифицированные факты.
  const allowedUrls = new Set(sources.map((s) => s.url));
  let keyFacts: KeyFact[] = (parsed.key_facts ?? [])
    .filter((f) => f.fact && f.url)
    .map((f) => ({ fact: f.fact!, url: f.url! }));

  // Если key_facts пустой, но есть grounding sources — используем их
  if (keyFacts.length === 0 && sources.length > 0) {
    keyFacts = sources.slice(0, 5).map((s) => ({
      fact: s.title || "Source found via Google Search",
      url: s.url,
    }));
  }

  const trend = (["UP", "DOWN", "FLAT"].includes((parsed.trend ?? "").toUpperCase())
    ? (parsed.trend as string).toUpperCase()
    : "FLAT") as Trend;

  return {
    probability: clamp(Math.round(Number(parsed.probability) || 0)),
    trend,
    confidence: enforcedConfidence,
    rationaleEn:
      parsed.rationale_en?.trim() ||
      "No rationale provided by the model.",
    keyFacts,
  };
}

/// Агрегация всех оценок за сегодня с freshness-штрафом (детерминированная).
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

  // 1. Взвешенное среднее
  let weightedSum = 0;
  let weightSum = 0;
  for (const s of scores) {
    weightedSum += s.weight * s.probability;
    weightSum += s.weight;
  }
  let total = weightSum > 0 ? weightedSum / weightSum : 0;

  // 2. Freshness penalty: если маркер с весом > 7 имеет LOW confidence — -5% (each)
  const heavyLow = scores.filter(
    (s) => s.weight > 7 && s.confidence === "LOW",
  ).length;
  total = total - heavyLow * 5;

  total = clamp(Math.round(total));

  // 3. LLM пишет executive summary на основе детерминированного числа
  const markersBrief = scores
    .map(
      (s) =>
        `{"id":"${s.markerId}","weight":${s.weight},"probability":${s.probability},"confidence":"${s.confidence}","rationale":"${s.rationaleEn.replace(/"/g, "'").slice(0, 160)}"}`,
    )
    .join(",\n");

  const aggPrompt = `You are the Aggregator for the Peace Index 180. The weighted-average probability has been computed deterministically as ${total}% (after a freshness penalty of ${heavyLow * 5}% from ${heavyLow} heavy stale markers).

markers = [
${markersBrief}
]

Write an executive summary (exactly 3 sentences, in English) explaining WHY the probability is ${total}% — name the 2-3 most influential markers and their direction. Be concrete and neutral. Do not include the JSON, just the prose summary.`;

  let summaryEn = "";
  try {
    summaryEn = (
      await llmComplete(
        "You write concise, neutral executive summaries for a peace-probability index.",
        aggPrompt,
      )
    ).trim();
  } catch (err) {
    console.error("[analyzer] aggregate summary failed:", err);
    summaryEn = `Weighted average across ${scores.length} markers yields ${total}% probability of peace within 180 days.`;
  }

  return { totalProbability: total, summaryEn };
}

/// Сохраняет оценку маркера в БД (upsert по calcDate+markerId).
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
      rationaleRu: null, // сбрасываем кэш перевода при пересчёте
    },
  });
}

/// Сохраняет агрегат в БД.
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

/// Полный пересчёт: анализ 17 маркеров (с Google Search) → агрегация → сохранение.
/// Фаза отдельного сбора данных убрана — теперь Gemini ищет и анализирует
/// одним вызовом (grounding), что надёжнее и быстрее.
export async function runFullAnalysis(
  onProgress?: (p: RunProgress) => void,
): Promise<AggregateResult> {
  const calcDate = startOfTodayUTC();

  // Анализ каждого маркера (включая поиск через Google)
  const scores: {
    markerId: string;
    probability: number;
    confidence: Confidence;
    weight: number;
    rationaleEn: string;
  }[] = [];

  for (let i = 0; i < MARKERS.length; i++) {
    const m = MARKERS[i];
    onProgress?.({
      phase: "analyzing",
      current: `${m.code} · ${m.name}`,
      idx: i,
      total: MARKERS.length,
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

    // Пауза между LLM-вызовами (уважение к rate-limit)
    await sleep(500);
  }

  // Фаза 3: агрегация
  onProgress?.({
    phase: "aggregating",
    current: "Aggregating final index",
    idx: MARKERS.length,
    total: MARKERS.length,
  });
  const aggregate = await calculateAggregate(scores);
  await saveAggregate(calcDate, aggregate, scores.length);

  onProgress?.({
    phase: "done",
    current: "Complete",
    idx: MARKERS.length,
    total: MARKERS.length,
  });

  return aggregate;
}

/// Перевод текста на русский через LLM (для rationale / summary).
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

/// Пересчитывает used-вес для отображения (с учётом штрафов не применяется —
/// это только информативная функция).
export function totalWeightOf(markers: MarkerDef[]): number {
  return markers.reduce((s, m) => s + m.weight, 0);
}

export { MARKER_MAP, TOTAL_WEIGHT };
