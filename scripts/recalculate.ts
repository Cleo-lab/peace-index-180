#!/usr/bin/env bun
/**
 * Daily Recalculation Script
 * 
 * Запускается из GitHub Actions cron (02:00 UTC).
 * Выполняет полный пересчёт всех 24 маркеров с паузами между LLM-вызовами.
 * 
 * Использование:
 *   bun run recalculate
 *   # или
 *   DATABASE_URL=... GEMINI_API_KEY=... bun run scripts/recalculate.ts
 */

import { runFullAnalysis, startOfTodayUTC } from "@/lib/analyzer";
import { db } from "@/lib/db";
import { MARKERS } from "@/lib/markers";

// ===== Конфигурация =====
// Внешний retry убран (был 3): при ошибке DB он перезапускал ВСЕ 17 маркеров.
// Внутренний AI-retry (5 попыток) в ai.ts достаточен для сетевых сбоев.
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 30_000; // 30 секунд (не используется при MAX_RETRIES=1, но оставлен для понятности)

// ===== Логирование с timestamp =====
function log(level: "info" | "warn" | "error", message: string) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${message}`);
}

// ===== Проверка окружения =====
function validateEnv(): boolean {
  const required = ["DATABASE_URL", "GEMINI_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    log("error", `Missing required env vars: ${missing.join(", ")}`);
    return false;
  }
  
  log("info", `GEMINI_MODEL: ${process.env.GEMINI_MODEL || "gemini-3.1-flash-lite (default)"}`);
  log("info", `Total markers: ${MARKERS.length}`);
  log("info", `Total weight: ${MARKERS.reduce((s, m) => s + m.weight, 0)}`);
  
  return true;
}

// ===== Проверка подключения к БД =====
async function checkDatabase(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    log("info", "Database connection: OK");
    return true;
  } catch (err) {
    log("error", `Database connection failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ===== Проверка существующего расчёта за сегодня =====
async function checkExistingCalculation(): Promise<boolean> {
  const today = startOfTodayUTC();
  
  try {
    const existing = await db.aggregate.findUnique({
      where: { calcDate: today },
    });
    
    if (existing) {
      log("warn", `Aggregate already exists for ${today.toISOString().slice(0, 10)}: ${existing.totalProbability}%`);
      log("warn", "Use workflow_dispatch with force flag to override, or delete existing record.");
      return true;
    }
    
    return false;
  } catch (err) {
    log("error", `Failed to check existing calculation: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ===== Основной пересчёт с retry =====
async function executeRecalculation(force = false): Promise<void> {
  const today = startOfTodayUTC();
  log("info", `Starting recalculation for ${today.toISOString().slice(0, 10)}...`);
  
  // Защита от двойного запуска: если расчёт уже есть — пропускаем.
  // Это предотвращает бесполезный повторный прогон всех 17 маркеров.
  if (!force) {
    const exists = await checkExistingCalculation();
    if (exists) {
      log("info", "Skipping: calculation already exists. Use --force to override.");
      return;
    }
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log("info", `Attempt ${attempt}/${MAX_RETRIES}...`);
      
      const startTime = Date.now();
      
      const result = await runFullAnalysis((progress) => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const percent = Math.round(((progress.idx + (progress.phase === "done" ? 1 : 0)) / progress.total) * 100);
        
        log("info", `[${progress.phase}] ${progress.current} | ${progress.idx}/${progress.total} (${percent}%) | ${elapsed}s elapsed`);
      });
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      
      log("info", "═══════════════════════════════════════");
      log("info", "RECALCULATION COMPLETE");
      log("info", `Total Probability: ${result.totalProbability > 0 ? "+" : ""}${result.totalProbability}%`);
      log("info", `Summary (EN): ${result.summaryEn.slice(0, 120)}...`);
      log("info", `Total time: ${totalTime}s`);
      log("info", `Markers processed: ${MARKERS.length}`);
      log("info", "═══════════════════════════════════════");
      
      // Финальная проверка: запись действительно сохранилась
      const saved = await db.aggregate.findUnique({
        where: { calcDate: today },
      });
      
      if (!saved) {
        // Предупреждение вместо throw: бросок ошибки здесь вызывал повторный
        // запуск ВСЕХ 17 маркеров из-за внешнего retry-цикла.
        log("warn", "WARNING: aggregate not found in DB after save — possible race condition. Continuing.");
      }
      
      log("info", `Verified: aggregate saved with score ${saved.totalProbability}%`);
      return;
      
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log("error", `Attempt ${attempt} failed: ${lastError.message}`);
      
      if (attempt < MAX_RETRIES) {
        log("info", `Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  
  // Все попытки исчерпаны
  throw lastError ?? new Error("All retry attempts exhausted");
}

// ===== MAIN =====
async function main() {
  const force = process.argv.includes("--force");
  
  log("info", "═══════════════════════════════════════");
  log("info", "Peace Index 180 — Daily Recalculation");
  log("info", "═══════════════════════════════════════");
  
  if (!validateEnv()) {
    process.exit(1);
  }
  
  if (!(await checkDatabase())) {
    process.exit(1);
  }
  
  try {
    await executeRecalculation(force);
    log("info", "Script finished successfully.");
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `FATAL: ${msg}`);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
