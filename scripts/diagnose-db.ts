/**
 * Peace Index 180 — Database State Diagnostic
 * ─────────────────────────────────────────────
 * Run: bun run scripts/diagnose-db.ts
 *
 * Reads the Neon database and shows exactly what data exists per marker.
 * Zero AI calls. Zero external HTTP. Safe to run as often as needed.
 *
 * Requires: DATABASE_URL in environment (same as recalculate.ts)
 */

import { PrismaClient } from "@prisma/client";

// ─── ANSI ────────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m",
  cyan: "\x1b[36m", gray: "\x1b[90m", white: "\x1b[97m",
};
const g = (s: string) => `${C.green}${s}${C.reset}`;
const y = (s: string) => `${C.yellow}${s}${C.reset}`;
const r = (s: string) => `${C.red}${s}${C.reset}`;
const d = (s: string) => `${C.dim}${s}${C.reset}`;
const b = (s: string) => `${C.bold}${s}${C.reset}`;

const W = 70;
const LINE = "─".repeat(W);
const BOLD_LINE = "━".repeat(W);

// ─── Marker registry (same 17 as the spec) ───────────────────────────────────
const MARKERS = [
  { id: "IMF_EFF",                  name: "IMF EFF Program",                   weight: 10 },
  { id: "WRI_INSURANCE",            name: "War Risk Insurance & MIGA/DFC",      weight: 10 },
  { id: "EBRD_PROJECTS",            name: "EBRD Projects",                      weight:  9 },
  { id: "KIEL_TRACKER",             name: "Kiel Ukraine Support Tracker",        weight:  8 },
  { id: "PORTS_GRAIN",              name: "Ports & Grain Corridor",              weight:  8 },
  { id: "RADA_FDI_LAWS",            name: "Verkhovna Rada FDI Laws",             weight:  9 },
  { id: "PROZORRO_PRIVATIZATION",   name: "Prozorro.Sale Large Privatization",   weight:  9 },
  { id: "EU_LEGISLATION",           name: "EU Legislation (Eur-Lex)",            weight:  8 },
  { id: "FRONTLINE_ISW",            name: "Frontline Dynamics (ISW)",            weight:  6 },
  { id: "COMBAT_INTENSITY_ACLED",   name: "Combat Intensity (ACLED)",            weight:  6 },
  { id: "REAR_STRIKES_UA",          name: "Rear Strikes / Alerts (Ukraine)",     weight:  5 },
  { id: "EQUIPMENT_LOSSES_ORYX",    name: "Equipment Losses (Oryx)",             weight:  5 },
  { id: "RUSSIAN_RHETORIC",         name: "Russian Official Rhetoric",           weight:  4 },
  { id: "RU_REAR_STRIKES",          name: "Russian Rear Strikes & Economy",      weight:  4 },
  { id: "RU_BUDGET_MOB",            name: "Russian Budget/Mobilization",         weight:  5 },
  { id: "G7_STATEMENTS",            name: "G7 / White House Statements",         weight:  2 },
  { id: "OSINT_TELEGRAM",           name: "OSINT Telegram Channels",             weight:  1 },
];

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function freshnessLabel(days: number | null): string {
  if (days === null) return r("no data");
  if (days === 0)    return g("today");
  if (days <= 3)     return g(`${days}d ago`);
  if (days <= 7)     return y(`${days}d ago`);
  if (days <= 14)    return y(`${days}d ago ⚠`);
  return r(`${days}d ago ✗ STALE`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(r("ERROR: DATABASE_URL is not set."));
    process.exit(1);
  }

  const prisma = new PrismaClient({ log: [] });

  console.log(`\n${b(BOLD_LINE)}`);
  console.log(`${C.bold}${C.cyan}  Peace Index 180 — Database State Diagnostic${C.reset}`);
  console.log(`${b(BOLD_LINE)}\n`);

  // ── 1. Connection check ───────────────────────────────────────────────────
  console.log(b("  1. Database Connection"));
  console.log(`  ${LINE}`);
  try {
    await prisma.$queryRaw`SELECT 1`;
    const url = process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@");
    console.log(`  ${g("✓")} Connected: ${d(url)}\n`);
  } catch (err) {
    console.error(`  ${r("✗ Connection failed:")} ${err}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── 2. Row counts ─────────────────────────────────────────────────────────
  const totalRaw = await (prisma as any).rawEvent.count();
  const totalScores = await (prisma as any).markerScore.count();
  const totalAggregates = await (prisma as any).aggregate.count();
  console.log(b("  2. Table Sizes"));
  console.log(`  ${LINE}`);
  console.log(`  RawEvent      ${String(totalRaw).padStart(6)} rows`);
  console.log(`  MarkerScore   ${String(totalScores).padStart(6)} rows`);
  console.log(`  Aggregate     ${String(totalAggregates).padStart(6)} rows\n`);

  // ── 3. Per-marker event stats ─────────────────────────────────────────────
  const since30 = new Date(Date.now() - 30 * 86_400_000);

  console.log(b("  3. Raw Events per Marker  (last 30 days)"));
  console.log(`  ${LINE}`);
  console.log(
    `  ${"MARKER_ID".padEnd(30)} ${"TOTAL".padStart(6)}  ${"LAST 30d".padStart(8)}  LATEST EVENT`
  );
  console.log(`  ${"─".repeat(65)}`);

  type MarkerRow = { markerId: string; count: bigint; latest: Date | null };

  // Group by markerId with count and latest date
  const rawStats = await (prisma as any).$queryRaw`
    SELECT 
      "markerId",
      COUNT(*)::int AS count,
      MAX("eventDate") AS latest
    FROM "RawEvent"
    GROUP BY "markerId"
  ` as MarkerRow[];

  const statByMarker = new Map(rawStats.map((r: any) => [r.markerId, r]));

  // Count events in last 30 days per marker
  const recent30 = await (prisma as any).$queryRaw`
    SELECT "markerId", COUNT(*)::int AS count
    FROM "RawEvent"
    WHERE "eventDate" >= ${since30}
    GROUP BY "markerId"
  ` as { markerId: string; count: number }[];
  const recent30Map = new Map(recent30.map((r: any) => [r.markerId, r.count]));

  let markersWithData = 0;
  let markersEmpty = 0;
  const emptyMarkers: string[] = [];

  for (const m of MARKERS) {
    const stat = statByMarker.get(m.id) as any;
    const total = stat ? Number(stat.count) : 0;
    const last30 = recent30Map.get(m.id) ?? 0;
    const latest = stat?.latest ? new Date(stat.latest) : null;
    const days = daysSince(latest);
    const freshness = freshnessLabel(days);

    if (total === 0) {
      markersEmpty++;
      emptyMarkers.push(m.id);
    } else {
      markersWithData++;
    }

    const countCol = total === 0 ? r("0".padStart(6)) : g(String(total).padStart(6));
    const last30Col = last30 === 0 ? r("0".padStart(8)) : y(String(last30).padStart(8));
    console.log(`  ${m.id.padEnd(30)} ${countCol}  ${last30Col}  ${freshness}`);
  }
  console.log();

  // ── 4. Latest sample events ───────────────────────────────────────────────
  console.log(b("  4. Latest 5 Raw Events (most recent overall)"));
  console.log(`  ${LINE}`);

  const latestEvents = await (prisma as any).rawEvent.findMany({
    orderBy: { eventDate: "desc" },
    take: 5,
    select: { markerId: true, eventDate: true, sourceName: true, rawText: true, sourceUrl: true }
  });

  if (latestEvents.length === 0) {
    console.log(`  ${r("No events found in database at all.")}`);
  } else {
    for (const ev of latestEvents) {
      const age = daysSince(new Date(ev.eventDate));
      console.log(`  ${d("•")} ${y(ev.markerId)} | ${d(new Date(ev.eventDate).toISOString().slice(0,10))} (${age}d ago)`);
      console.log(`    ${C.gray}Source: ${ev.sourceName}${C.reset}`);
      console.log(`    ${ev.rawText.slice(0, 100).replace(/\n/g, " ")}…`);
      console.log(`    ${d(ev.sourceUrl.slice(0, 80))}`);
      console.log();
    }
  }

  // ── 5. Today's MarkerScores ───────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const todayScores = await (prisma as any).markerScore.findMany({
    where: { calcDate: new Date(today) },
    orderBy: { weight: "desc" }
  });

  console.log(b(`  5. Today's Marker Scores  (${today})`));
  console.log(`  ${LINE}`);

  if (todayScores.length === 0) {
    console.log(`  ${y("No scores recorded for today yet.")}\n`);
  } else {
    console.log(
      `  ${"MARKER_ID".padEnd(30)} ${"PROB".padStart(5)}  TREND  CONF    W`
    );
    console.log(`  ${"─".repeat(58)}`);
    for (const s of todayScores) {
      const prob = s.probability === 0
        ? r(`${s.probability}%`.padStart(5))
        : s.probability < 20
        ? y(`${s.probability}%`.padStart(5))
        : g(`${s.probability}%`.padStart(5));
      const conf = s.confidence === "LOW" ? r(s.confidence.padEnd(6)) : y(s.confidence.padEnd(6));
      console.log(`  ${s.markerId.padEnd(30)} ${prob}  ${s.trend.padEnd(5)}  ${conf}  ${s.weight}`);
    }
    console.log();

    // Show one rationale as sample
    const sample = todayScores[0];
    if (sample?.rationaleEn) {
      console.log(`  ${b("Sample rationale")} (${sample.markerId}):`);
      console.log(`  ${d(sample.rationaleEn.slice(0, 200))}…\n`);
    }
  }

  // ── 6. Latest Aggregate ───────────────────────────────────────────────────
  const latestAgg = await (prisma as any).aggregate.findFirst({
    orderBy: { calcDate: "desc" }
  });

  console.log(b("  6. Latest Aggregate"));
  console.log(`  ${LINE}`);
  if (!latestAgg) {
    console.log(`  ${y("No aggregates recorded yet.")}\n`);
  } else {
    const aggDate = new Date(latestAgg.calcDate).toISOString().slice(0, 10);
    const prob = latestAgg.totalProbability;
    console.log(`  Date:        ${aggDate}`);
    console.log(`  Probability: ${prob === 0 ? r(`${prob}%`) : g(`${prob}%`)}`);
    console.log(`  Markers:     ${latestAgg.markerCount}`);
    if (latestAgg.summaryEn) {
      console.log(`  Summary:     ${d(latestAgg.summaryEn.slice(0, 200))}…`);
    }
    console.log();
  }

  // ── 7. Diagnosis ─────────────────────────────────────────────────────────
  console.log(`\n${b(BOLD_LINE)}`);
  console.log(`${C.bold}${C.cyan}  Diagnosis${C.reset}`);
  console.log(`${b(BOLD_LINE)}`);
  console.log(`  Markers with data:   ${g(String(markersWithData) + "/17")}`);
  console.log(`  Markers EMPTY:       ${markersEmpty === 0 ? g("0/17  ✓ all good") : r(String(markersEmpty) + "/17  ← root cause of 0%")}`);

  if (emptyMarkers.length > 0) {
    console.log(`\n  Empty markers:`);
    for (const id of emptyMarkers) {
      const m = MARKERS.find(x => x.id === id)!;
      console.log(`    ${r("✗")} ${id.padEnd(30)} (weight ${m.weight})`);
    }
    console.log(`
  ${b("Why 0%:")} Gemini receives empty INPUT_DATA for these markers and
  correctly returns probability=0 (no data = no signal).

  ${b("Fix needed in analyzer.ts:")}
  Skip the Gemini call when rawEvents.length === 0 for a marker.
  Write a LOW-confidence placeholder instead:
    { probability: null, confidence: "LOW", trend: "FLAT",
      rationale_en: "No data collected for this marker in the last 30 days.",
      key_facts: [] }
  Then exclude null-probability markers from the weighted average.
  This saves 17 tokens and gives a meaningful index from the markers
  that DO have data.`);
  } else {
    console.log(`\n  ${g("All markers have data.")} If probability is still 0%, the issue`);
    console.log(`  is in the AI prompt — Gemini is scoring all signals as pessimistic.`);
    console.log(`  Run: bun run scripts/diagnose-rss.ts to see what data was collected.`);
  }

  console.log(`\n${b(BOLD_LINE)}\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(r("Fatal error:"), err);
  process.exit(1);
});
