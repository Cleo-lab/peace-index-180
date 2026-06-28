#!/usr/bin/env bun
/**
 * One-time batch translation script
 * 
 * Переводит ВСЕ сегодняшние данные ОДНИМ запросом к Gemini:
 * - 24 rationaleEn → rationaleRu
 * - summaryEn → summaryRu
 * 
 * Использование:
 *   bun run scripts/translate-today-batch.ts
 */

import { db } from "@/lib/db";
import { startOfTodayUTC } from "@/lib/analyzer";
import { llmCompleteText } from "@/lib/ai";

function log(level: "info" | "warn" | "error", message: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] ${message}`);
}

// ===== MAIN =====
async function main() {
  log("info", "═══════════════════════════════════════");
  log("info", "Peace Index 180 — Batch Translation (1 request)");
  log("info", "═══════════════════════════════════════");

  if (!process.env.DATABASE_URL || !process.env.GEMINI_API_KEY) {
    log("error", "DATABASE_URL and GEMINI_API_KEY required");
    process.exit(1);
  }

  const today = startOfTodayUTC();
  const todayStr = today.toISOString().slice(0, 10);
  log("info", `Target date: ${todayStr}`);

  // ===== 1. Загружаем данные =====
  const aggregate = await db.aggregate.findUnique({ where: { calcDate: today } });
  if (!aggregate) {
    log("error", `No aggregate found for ${todayStr}`);
    process.exit(1);
  }

  const scores = await db.markerScore.findMany({
    where: { calcDate: today },
    orderBy: { markerId: "asc" },
  });

  log("info", `Found: 1 aggregate + ${scores.length} marker scores`);

  // Проверяем, что нужно переводить
  const needSummaryRu = !aggregate.summaryRu || aggregate.summaryRu.trim().length === 0;
  const needMarkerTranslations = scores.filter(s => !s.rationaleRu || s.rationaleRu.trim().length === 0);

  if (!needSummaryRu && needMarkerTranslations.length === 0) {
    log("info", "Everything already translated. Nothing to do.");
    process.exit(0);
  }

  log("info", `To translate: summary=${needSummaryRu ? "yes" : "no"}, markers=${needMarkerTranslations.length}`);

  // ===== 2. Формируем пакетный промпт =====
  const payloadItems: string[] = [];

  if (needSummaryRu) {
    payloadItems.push(`  "summary": ${JSON.stringify(aggregate.summaryEn)}`);
  }

  for (const s of needMarkerTranslations) {
    payloadItems.push(`  "${s.markerId}": ${JSON.stringify(s.rationaleEn)}`);
  }

  const batchPrompt = `Translate the following English texts into natural, accurate Russian. Preserve meaning, neutrality, and any URLs. Return ONLY a valid JSON object where keys are the same as below and values are Russian translations.

{
${payloadItems.join(",\n")}
}`;

  log("info", `Batch prompt: ${payloadItems.length} items, ~${batchPrompt.length} chars`);

  // ===== 3. Один вызов API =====
  log("info", "Sending single batch request to Gemini...");
  let parsed: Record<string, string>;
  
  try {
    const raw = await llmCompleteText(
      "You are a professional translator. Translate to Russian accurately. Return only valid JSON with the same keys as input.",
      batchPrompt,
    );

    // Чистим от markdown-фенсинга если есть
    const cleaned = raw
      .trim()
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    parsed = JSON.parse(cleaned);
    log("info", `API returned ${Object.keys(parsed).length} translations`);
  } catch (err) {
    log("error", `Batch translation failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // ===== 4. Сохраняем результат =====
  let saved = 0;

  // Aggregate
  if (needSummaryRu && parsed.summary) {
    await db.aggregate.update({
      where: { calcDate: today },
      data: { summaryRu: parsed.summary },
    });
    log("info", `✓ summaryRu saved (${parsed.summary.length} chars)`);
    saved++;
  }

  // MarkerScores
  for (const s of needMarkerTranslations) {
    const ru = parsed[s.markerId];
    if (ru) {
      await db.markerScore.update({
        where: { id: s.id },
        data: { rationaleRu: ru },
      });
      log("info", `✓ ${s.markerId}: saved (${ru.length} chars)`);
      saved++;
    } else {
      log("warn", `✗ ${s.markerId}: missing in API response`);
    }
  }

  // ===== Итог =====
  log("info", "═══════════════════════════════════════");
  log("info", "BATCH TRANSLATION COMPLETE");
  log("info", `Requested: ${payloadItems.length} | Received: ${Object.keys(parsed).length} | Saved: ${saved}`);
  log("info", "═══════════════════════════════════════");

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
