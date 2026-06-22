import ZAI from "z-ai-web-dev-sdk";

let _zai: ZAI | null = null;

/// Инициализация ZAI SDK.
/// В локальной разработке: читает `.z-ai-config` файл (через встроенный загрузчик SDK).
/// На Vercel/production: читает переменные окружения ZAI_API_KEY и др.
export async function getZAI(): Promise<ZAI> {
  if (_zai) return _zai;

  // Сначала пробуем файловый конфиг (локальная разработка)
  try {
    _zai = await ZAI.create();
    return _zai;
  } catch {
    // Файл не найден — пробуем env vars (Vercel / production)
  }

  if (!process.env.ZAI_API_KEY) {
    throw new Error(
      "ZAI not configured. Either create .z-ai-config file or set ZAI_API_KEY env var.",
    );
  }

  // Создаём инстанс напрямую из env vars
  _zai = new ZAI({
    baseUrl: process.env.ZAI_BASE_URL || "https://internal-api.z.ai/v1",
    apiKey: process.env.ZAI_API_KEY,
    chatId: process.env.ZAI_CHAT_ID || "production",
    userId: process.env.ZAI_USER_ID || "vercel-user",
    token: process.env.ZAI_TOKEN || process.env.ZAI_API_KEY,
  });

  return _zai;
}

/// Пауза между LLM-вызовами (уважение rate-limit).
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
