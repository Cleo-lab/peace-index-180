/// Standalone-скрипт пересчёта индекса.
/// Запускается локально или в GitHub Actions (cron).
/// Использование: bun run scripts/recalculate.ts
///
/// Требует переменные окружения:
///   DATABASE_URL — строка подключения к PostgreSQL (Neon)
///   GEMINI_API_KEY — ключ Google Gemini API (рекомендуется, бесплатно)
///   GEMINI_MODEL — (опц.) модель, по умолчанию gemini-3.1-flash-lite

import { runFullAnalysis } from "../src/lib/analyzer";
import { getAIMode, initAI } from "../src/lib/ai";

async function main() {
  const startTime = Date.now();
  console.log("━".repeat(60));
  console.log("  Peace Index 180 — Daily Recalculation");
  console.log("━".repeat(60));
  console.log();

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }

  // Определяем режим AI
  await initAI();
  const mode = getAIMode();
  const modeLabel =
    mode === "gemini"
      ? `Google Gemini API (model: ${process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"}) + Google News RSS`
      : mode === "sdk"
        ? "z-ai SDK (sandbox)"
        : "UNKNOWN — no API key set";
  console.log("AI mode:", modeLabel);
  if (mode === "unknown") {
    console.error("");
    console.error("ERROR: No AI provider configured.");
    console.error("Set GEMINI_API_KEY env var (get free key at https://aistudio.google.com/apikey)");
    process.exit(1);
  }
  console.log("Database:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  console.log();

  try {
    const result = await runFullAnalysis((p) => {
      const pct = p.total > 0 ? Math.round((p.idx / p.total) * 100) : 0;
      const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
      console.log(
        `  [${bar}] ${pct}% | ${p.phase} | ${p.current} (${p.idx}/${p.total})`,
      );
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log();
    console.log("━".repeat(60));
    console.log(`  ✓ Complete in ${elapsed}s`);
    console.log(`  Total probability: ${result.totalProbability}%`);
    console.log(`  Summary: ${result.summaryEn.slice(0, 120)}...`);
    console.log("━".repeat(60));
    process.exit(0);
  } catch (err) {
    console.error();
    console.error("━".repeat(60));
    console.error("  ✗ FAILED");
    console.error("  ", err instanceof Error ? err.message : String(err));
    console.error("━".repeat(60));
    process.exit(1);
  }
}

main();
