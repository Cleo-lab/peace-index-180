/// Unified AI interface — использует Google Gemini API.
///
/// Два режима вызова:
/// 1. **llmComplete** — обычный LLM-вызов (агрегация, перевод)
/// 2. **llmCompleteWithSearch** — LLM + Google Search (анализ маркеров)
///
/// Для поиска используется встроенный Google Search в Gemini (grounding),
/// а не DuckDuckGo (который блокирует серверные запросы).
/// Grounding возвращает source URLs — для антигаллюцинации.

import ZAI from "z-ai-web-dev-sdk";

type AIMode = "gemini" | "sdk" | "unknown";
let _mode: AIMode = "unknown";
let _zai: ZAI | null = null;
let _sdkTried = false;

/// Модель для grounded search+analysis (поддерживает google_search).
/// gemini-2.5-flash поддерживает grounding в бесплатном тарифе.
const GROUNDED_MODEL =
  process.env.GEMINI_GROUNDED_MODEL || "gemini-3.1-flash-lite";

/// Модель для обычных LLM-задач (агрегация, перевод).
const LLM_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

export async function initAI(): Promise<AIMode> {
  if (_mode !== "unknown") return _mode;

  if (process.env.GEMINI_API_KEY) {
    _mode = "gemini";
    return _mode;
  }

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

// ============ LLM (без поиска) ============

export async function llmComplete(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  await initAI();

  if (_mode === "gemini") {
    return llmCompleteGemini(systemPrompt, userMessage, LLM_MODEL);
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

// ============ LLM + Google Search (grounding) ============

export interface GroundedResult {
  text: string;
  sources: { url: string; title: string }[];
}

/// LLM-вызов с встроенным Google Search.
/// Gemini ищет актуальные данные в Google и анализирует их.
/// Возвращает текст ответа + список источников (URL) для антигаллюцинации.
export async function llmCompleteWithSearch(
  systemPrompt: string,
  userMessage: string,
): Promise<GroundedResult> {
  await initAI();

  if (_mode === "gemini") {
    return llmCompleteGeminiGrounded(systemPrompt, userMessage);
  }

  // Sandbox fallback: используем SDK (web_search) + обычный LLM
  if (_mode === "sdk" && _zai) {
    const { searchWeb } = await import("./ai");
    // Извлекаем поисковый запрос из userMessage (берём первую строку)
    const query = userMessage.split("\n")[0].slice(0, 100);
    const results = await searchWeb(query, 8);
    const sources = results.map((r) => ({ url: r.url, title: r.name }));
    const text = await llmComplete(systemPrompt, userMessage);
    return { text, sources };
  }

  throw new Error(
    "AI not available. Set GEMINI_API_KEY env var (recommended).",
  );
}

async function llmCompleteGemini(
  systemPrompt: string,
  userMessage: string,
  model: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

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

async function llmCompleteGeminiGrounded(
  systemPrompt: string,
  userMessage: string,
): Promise<GroundedResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const url = `${GEMINI_BASE_URL}/${GROUNDED_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini grounded API error ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("") ?? "";

  if (!text) throw new Error("Gemini grounded API returned empty response");

  // Извлекаем источники из grounding metadata
  const sources: { url: string; title: string }[] = [];
  if (data.groundingMetadata?.groundingChunks) {
    for (const chunk of data.groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) {
        sources.push({
          url: chunk.web.uri,
          title: chunk.web.title || "",
        });
      }
    }
  }

  return { text, sources };
}

// ============ Web Search (legacy, для sandbox) ============

export interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date?: string;
}

/// Веб-поиск — только для sandbox (z-ai SDK).
/// В production (GitHub Actions/Vercel) используйте llmCompleteWithSearch.
export async function searchWeb(
  query: string,
  num = 8,
): Promise<SearchResult[]> {
  await initAI();

  if (_mode === "sdk" && _zai) {
    try {
      const raw = await _zai.functions.invoke("web_search", { query, num });
      if (Array.isArray(raw)) return raw as SearchResult[];
    } catch {
      _zai = null;
    }
  }

  // DuckDuckGo заблокирован на серверах — возвращаем пусто
  console.error(
    "[search] DuckDuckGo is blocked on servers. Use llmCompleteWithSearch instead.",
  );
  return [];
}

// ============ Utilities ============

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getAIMode(): AIMode {
  return _mode;
}

export async function trySandboxInit(): Promise<ZAI | null> {
  await initAI();
  return _zai;
}
