/// Unified AI interface — использует ТОЛЬКО Google Gemini API.
///
/// Модель: gemini-2.5-flash-lite (бесплатная, быстрая, поддерживает текст).
///
/// ВАЖНО: gemini-2.5-flash-lite НЕ поддерживает Google Search grounding.
/// Для сбора данных используется Google News RSS (src/lib/rss.ts).

import ZAI from "z-ai-web-dev-sdk";

type AIMode = "gemini" | "sdk" | "unknown";
let _mode: AIMode = "unknown";
let _zai: ZAI | null = null;
let _sdkTried = false;

/// Единственная модель — gemini-2.5-flash-lite (как требует пользователь).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

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

/// Chat completion через системный + пользовательский промпт.
/// Возвращает текст ответа модели (только gemini-2.5-flash-lite).
export async function llmComplete(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  await initAI();

  if (_mode === "gemini") {
    return llmCompleteGemini(systemPrompt, userMessage);
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
