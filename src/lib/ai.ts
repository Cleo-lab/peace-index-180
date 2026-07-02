/// Unified AI interface — использует ТОЛЬКО Google Gemini API.
///
/// Модель: gemini-3.1-flash-lite (бесплатная, быстрая).
///
/// ВАЖНО: gemini-3.1-flash-lite НЕ поддерживает Google Search grounding.
/// Для сбора данных используется Google News RSS (src/lib/rss.ts).
///
/// ШКАЛА АНАЛИЗА: -100 (максимальная эскалация/война) → 0 (стагнация) → +100 (гарантированный мир).
/// Модель обязана возвращать probability в этом диапазоне.
///
/// Retry-логика: при ошибках 429/500/503 выполняется до 5 попыток
/// с экспоненциальной задержкой и jitter.
/// Circuit breaker: после 3 подряд ошибок — fast-fail для оставшихся маркеров.

import ZAI from "z-ai-web-dev-sdk";

type AIMode = "gemini" | "sdk" | "unknown";
let _mode: AIMode = "unknown";
let _zai: ZAI | null = null;
let _sdkTried = false;

// === Circuit Breaker State ===
let _consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3;
let _circuitOpen = false;
let _circuitOpenUntil = 0;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000; // 1 минута

/// Единственная модель — gemini-3.1-flash-lite.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/// Максимальное количество попыток при retriable ошибках.
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || "5");
/// Базовая задержка между попытками (мс).
const BASE_DELAY_MS = Number(process.env.AI_BASE_DELAY_MS || "5000");
/// Таймаут на один запрос к API (мс).
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || "30000");
/// Температура для аналитических задач (низкая для стабильности чисел).
const ANALYTICS_TEMPERATURE = 0.15;

export async function initAI(): Promise<AIMode> {
  if (_mode !== "unknown") return _mode;

  if (process.env.GEMINI_API_KEY) {
    _mode = "gemini";
    return _mode;
  }

  // Sandbox fallback (z-ai SDK)
  if (!_sdkTried) {
    _sdkTried = true;
    try {
      _zai = await ZAI.create();
      _mode = "sdk";
      return _mode;
    } catch {
      _zai = null;
    }
  }

  return _mode;
}

/// Sleep-утилита.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// Jitter: добавляет случайность к задержке (±25%), чтобы избежать
/// thundering herd при восстановлении API.
function jitteredDelay(baseMs: number, attempt: number): number {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  const jitter = exponential * 0.25 * (Math.random() * 2 - 1); // ±25%
  return Math.max(1000, Math.round(exponential + jitter));
}

/// Проверяет, открыт ли circuit breaker.
function checkCircuitBreaker(): void {
  if (!_circuitOpen) return;
  if (Date.now() >= _circuitOpenUntil) {
    // Circuit полузакрыт — даём один шанс
    _circuitOpen = false;
    _consecutiveFailures = 0;
    console.log("[ai] circuit breaker half-open, allowing one request");
    return;
  }
  const remaining = Math.ceil((_circuitOpenUntil - Date.now()) / 1000);
  throw new Error(
    `Circuit breaker OPEN: too many consecutive failures. Retry in ${remaining}s.`,
  );
}

/// Обновляет состояние circuit breaker после успеха/неудачи.
function recordSuccess(): void {
  _consecutiveFailures = 0;
  _circuitOpen = false;
}

function recordFailure(): void {
  _consecutiveFailures++;
  if (_consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    _circuitOpen = true;
    _circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.error(
      `[ai] circuit breaker OPENED after ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures. Cooling down for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s.`,
    );
  }
}

/// Chat completion через системный + пользовательский промпт.
/// При retriable ошибках выполняет retry с экспоненциальной задержкой + jitter.
/// Использует circuit breaker для защиты от каскадных ошибок.
export async function llmComplete(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  await initAI();

  if (_mode === "gemini") {
    return llmCompleteGeminiWithRetry(systemPrompt, userMessage);
  }

  if (_mode === "sdk" && _zai) {
    try {
      const completion = await _zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        thinking: { type: "disabled" },
      });
      const text = completion.choices[0]?.message?.content ?? "";
      if (text) return text;
    } catch {
      _zai = null;
    }
  }

  throw new Error(
    "AI not available. Set GEMINI_API_KEY env var (recommended).",
  );
}
/// Chat completion для PLAIN TEXT (без JSON-форсирования).
/// Используется для aggregate summary и других текстовых задач.
export async function llmCompleteText(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  await initAI();

  if (_mode === "gemini") {
    return llmCompleteGeminiText(systemPrompt, userMessage);
  }

  // Fallback: используем обычный llmComplete (SDK режим)
  return llmComplete(systemPrompt, userMessage);
}
/// Вызов Gemini с retry + circuit breaker + timeout при временных ошибках.
async function llmCompleteGeminiWithRetry(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  // Circuit breaker: если API нестабилен — fail fast
  checkCircuitBreaker();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await llmCompleteGemini(systemPrompt, userMessage);
      recordSuccess();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(msg);

      // Retry при: 429 (rate limit), 500 (server error), 503 (overloaded),
      // ECONNRESET, ETIMEDOUT, timeout
      const isRetryable =
        msg.includes("429") ||
        msg.includes("500") ||
        msg.includes("503") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("timeout") ||
        msg.includes("aborted");

      if (!isRetryable || attempt === MAX_RETRIES) {
        recordFailure();
        throw lastError;
      }

      const delayMs = jitteredDelay(BASE_DELAY_MS, attempt);
      console.error(
        `[ai] attempt ${attempt}/${MAX_RETRIES} failed (${msg.slice(0, 80)}...), retrying in ${delayMs / 1000}s...`,
      );
      await sleep(delayMs);
    }
  }

  recordFailure();
  throw lastError ?? new Error("Unexpected retry loop exit");
}

/// Промпт → JSON Schema для строгой типизации ответа Gemini.
/// ШКАЛА: probability ∈ [-100, +100], где -100 = макс. эскалация, +100 = мир.
const MARKER_RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    probability: { type: "integer" as const, minimum: -100, maximum: 100 },
    trend: {
      type: "string" as const,
      enum: ["UP", "DOWN", "FLAT"],
    },
    confidence: {
      type: "string" as const,
      enum: ["HIGH", "MEDIUM", "LOW"],
    },
    rationale_en: { type: "string" as const },
    key_facts: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          fact: { type: "string" as const },
          url: { type: "string" as const },
        },
        required: ["fact", "url"],
      },
    },
    // Отслеживание позиций конкретных институциональных игроков (инвесторов,
    // страховщиков, законодателей) — заполняется, только когда в новостях назван
    // конкретный актор с конкретным финансовым/юридическим заявлением. В остальных
    // случаях — пустой массив.
    entity_updates: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          entity_name: { type: "string" as const },
          stance: {
            type: "string" as const,
            enum: ["NEW", "REAFFIRMED", "INCREASED", "REDUCED", "WITHDRAWN"],
          },
          claim_summary: { type: "string" as const },
          claim_date: { type: "string" as const },
          url: { type: "string" as const },
        },
        required: ["entity_name", "stance", "claim_summary", "claim_date", "url"],
      },
    },
  },
  required: [
    "probability",
    "trend",
    "confidence",
    "rationale_en",
    "key_facts",
    "entity_updates",
  ],
};

/// Базовый вызов Gemini API (generateContent) с timeout и JSON-режимом.
async function llmCompleteGemini(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // AbortController для таймаута
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: ANALYTICS_TEMPERATURE,
          maxOutputTokens: 2048,
          topP: 0.9,
          // ГАРАНТИРОВАННЫЙ JSON: модель обязана вернуть валидный JSON
          responseMimeType: "application/json",
          responseSchema: MARKER_RESPONSE_SCHEMA,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
    }

    // При responseMimeType: "application/json" текст уже валидный JSON
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("") ?? "";

    if (!text) throw new Error("Gemini API returned empty response");
    return text;
  } catch (err) {
    // Преобразуем AbortError в понятное сообщение
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Gemini API timeout after ${REQUEST_TIMEOUT_MS}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
/// Базовый вызов Gemini API для PLAIN TEXT (без JSON-режима).
/// Используется для aggregate summary, где нужен чистый текст.
async function llmCompleteGeminiText(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: ANALYTICS_TEMPERATURE,
          maxOutputTokens: 2048,
          topP: 0.9,
          // БЕЗ responseMimeType и responseSchema — plain text
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
    }

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("") ?? "";

    if (!text) throw new Error("Gemini API returned empty response");
    return text;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Gemini API timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
/// Вызывает LLM и гарантированно парсит JSON через responseSchema.
/// Возвращает типизированный объект — не нужен ручной extractJson!
/// Дополнительно выполняет пост-валидацию: probability клэмпится в [-100, 100].
export async function llmCompleteJson<T>(
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const raw = await llmComplete(systemPrompt, userMessage);
  // При responseMimeType: "application/json" ответ уже валидный JSON
  const parsed = JSON.parse(raw) as T;

  // ===== Пост-валидация маркерных ответов =====
  // Защита от редких случаев, когда модель игнорирует JSON Schema
  if (parsed && typeof parsed === "object" && "probability" in parsed) {
    const p = (parsed as Record<string, unknown>).probability;
    if (typeof p === "number") {
      if (p < -100 || p > 100) {
        console.warn(
          `[ai] probability ${p} out of [-100, 100] range, clamping`,
        );
        (parsed as Record<string, unknown>).probability = clampProbability(p);
      }
    }
  }

  return parsed;
}

/// Безопасное ограничение probability в диапазон [-100, 100].
export function clampProbability(n: number): number {
  return Math.max(-100, Math.min(100, Math.round(n)));
}

// ============ Utilities (экспорт) ============

export { sleep };

export function getAIMode(): AIMode {
  return _mode;
}

export async function trySandboxInit(): Promise<ZAI | null> {
  await initAI();
  return _zai;
}

/// Статус circuit breaker для мониторинга.
export function getCircuitBreakerStatus(): {
  open: boolean;
  consecutiveFailures: number;
  openUntil?: number;
} {
  return {
    open: _circuitOpen,
    consecutiveFailures: _consecutiveFailures,
    openUntil: _circuitOpen ? _circuitOpenUntil : undefined,
  };
}

/// Сброс circuit breaker (для ручного восстановления).
export function resetCircuitBreaker(): void {
  _circuitOpen = false;
  _consecutiveFailures = 0;
  _circuitOpenUntil = 0;
  console.log("[ai] circuit breaker manually reset");
}
