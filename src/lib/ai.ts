/// Unified AI interface — использует ТОЛЬКО Google Gemini API.
///
/// Модель: gemini-2.5-flash-lite (бесплатная, быстрая).
///
/// ВАЖНО: gemini-2.5-flash-lite НЕ поддерживает Google Search grounding.
/// Для сбора данных используется Google News RSS (src/lib/rss.ts).
///
/// Retry-логика: при ошибках 429 (rate limit) и 503 (overloaded)
/// выполняется до 5 попыток с экспоненциальной задержкой.

import ZAI from "z-ai-web-dev-sdk";

type AIMode = "gemini" | "sdk" | "unknown";
let _mode: AIMode = "unknown";
let _zai: ZAI | null = null;
let _sdkTried = false;

/// Единственная модель — gemini-2.5-flash-lite.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/// Максимальное количество попыток при 429/503 ошибках.
const MAX_RETRIES = 5;
/// Базовая задержка между попытками (мс). Удваивается каждую попытку.
const BASE_DELAY_MS = 5000; // 5с, 10с, 20с, 40с, 80с

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

/// Chat completion через системный + пользовательский промпт.
/// При 429/503 ошибках выполняет retry с экспоненциальной задержкой.
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

/// Вызов Gemini с retry при временных ошибках (429, 503).
async function llmCompleteGeminiWithRetry(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await llmCompleteGemini(systemPrompt, userMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(msg);

      // Retry только при 429 (rate limit) и 503 (overloaded)
      const isRetryable = msg.includes("429") || msg.includes("503");

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw lastError;
      }

      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.error(
        `[ai] attempt ${attempt}/${MAX_RETRIES} failed (${msg.slice(0, 80)}...), retrying in ${delayMs / 1000}s...`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error("Unexpected retry loop exit");
}

/// Базовый вызов Gemini API (generateContent).
async function llmCompleteGemini(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    }),
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
