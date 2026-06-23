/**
 * Peace Index 180 — Google News RSS Diagnostic
 * ──────────────────────────────────────────────
 * Run: bun run scripts/diagnose-rss.ts
 *
 * Tests Google News RSS for all 17 markers.
 * Shows exactly what headlines are being found per marker.
 * Zero database calls. Zero AI calls. Safe to run freely.
 *
 * If a marker shows 0 items here → that's why it's scoring 0%.
 */

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
const BOLD_LINE = "━".repeat(W);

// ─── RSS parser (no deps, same approach as rss.ts in the project) ─────────────
interface NewsItem {
  title: string;
  url: string;
  date: string;
  source: string;
  snippet: string;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[\\s\\S]*?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    "i"
  );
  const m = xml.match(re);
  return m ? (m[1] || m[2] || "").trim() : "";
}
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function parseRSS(xml: string, maxItems = 5): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null && items.length < maxItems) {
    const block = m[1]!;
    const title = decodeEntities(extractTag(block, "title")).trim();
    const link = extractTag(block, "link").trim();
    const pubDate = extractTag(block, "pubDate").trim();
    const desc = decodeEntities(stripTags(extractTag(block, "description"))).trim();
    const sourceTag = extractTag(block, "source");
    let source = sourceTag || "Google News";
    if (!sourceTag && link) {
      try { source = new URL(link).hostname.replace("www.", ""); } catch { }
    }
    if (!title || !link) continue;
    const date = pubDate ? new Date(pubDate) : new Date();
    if (isNaN(date.getTime())) continue;
    items.push({
      title,
      url: link,
      date: date.toISOString().slice(0, 10),
      source,
      snippet: (desc || title).slice(0, 120)
    });
  }
  return items;
}

async function fetchGoogleNews(query: string, maxItems = 5): Promise<{
  items: NewsItem[];
  status: number;
  elapsed: number;
  error?: string;
}> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/rss+xml,application/xml,text/xml,*/*",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const elapsed = Date.now() - t0;
    if (!res.ok) return { items: [], status: res.status, elapsed, error: `HTTP ${res.status}` };
    const xml = await res.text();
    const items = parseRSS(xml, maxItems);
    return { items, status: res.status, elapsed };
  } catch (err) {
    const elapsed = Date.now() - t0;
    return {
      items: [],
      status: 0,
      elapsed,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

// ─── Marker definitions with their Google News queries ─────────────────────
// These are the queries your analyzer.ts should be using. Compare with your
// actual analyzer to check for mismatches.
const MARKERS = [
  {
    id: "IMF_EFF", name: "IMF EFF Program", weight: 10,
    queries: [
      "Ukraine IMF program review 2025",
      "Ukraine Extended Fund Facility disbursement"
    ]
  },
  {
    id: "WRI_INSURANCE", name: "War Risk Insurance & MIGA/DFC", weight: 10,
    queries: [
      "Ukraine war risk insurance MIGA guarantee 2025",
      "DFC Ukraine investment guarantee"
    ]
  },
  {
    id: "EBRD_PROJECTS", name: "EBRD Projects", weight: 9,
    queries: [
      "EBRD Ukraine project investment 2025",
      "European Bank Reconstruction Ukraine loan"
    ]
  },
  {
    id: "KIEL_TRACKER", name: "Kiel Ukraine Support Tracker", weight: 8,
    queries: [
      "Kiel Institute Ukraine support military aid tracker",
      "Ukraine weapons aid committed billion 2025"
    ]
  },
  {
    id: "PORTS_GRAIN", name: "Ports & Grain Corridor", weight: 8,
    queries: [
      "Ukraine Black Sea grain corridor shipping 2025",
      "Ukraine port Odesa export grain wheat"
    ]
  },
  {
    id: "RADA_FDI_LAWS", name: "Verkhovna Rada FDI Laws", weight: 9,
    queries: [
      "Verkhovna Rada investment law foreign 2025",
      "Ukraine parliament FDI legislation concession"
    ]
  },
  {
    id: "PROZORRO_PRIVATIZATION", name: "Prozorro.Sale Privatization", weight: 9,
    queries: [
      "Ukraine privatization Prozorro state enterprise sale 2025",
      "Ukraine large asset privatization auction"
    ]
  },
  {
    id: "EU_LEGISLATION", name: "EU Legislation (Eur-Lex)", weight: 8,
    queries: [
      "European Union Ukraine regulation law 2025",
      "EU Ukraine reconstruction fund legislation"
    ]
  },
  {
    id: "FRONTLINE_ISW", name: "Frontline Dynamics (ISW)", weight: 6,
    queries: [
      "Ukraine frontline ISW Russian offensive assessment 2025",
      "Ukraine war front line territorial change"
    ]
  },
  {
    id: "COMBAT_INTENSITY_ACLED", name: "Combat Intensity (ACLED)", weight: 6,
    queries: [
      "Ukraine casualties battle intensity 2025",
      "Ukraine conflict armed events daily"
    ]
  },
  {
    id: "REAR_STRIKES_UA", name: "Rear Strikes Ukraine", weight: 5,
    queries: [
      "Russia Ukraine missile drone strike air raid 2025",
      "Ukraine ballistic missile attack alert"
    ]
  },
  {
    id: "EQUIPMENT_LOSSES_ORYX", name: "Equipment Losses (Oryx)", weight: 5,
    queries: [
      "Russia Ukraine equipment losses tanks destroyed Oryx 2025",
      "Russian military losses armored vehicles confirmed"
    ]
  },
  {
    id: "RUSSIAN_RHETORIC", name: "Russian Official Rhetoric", weight: 4,
    queries: [
      "Putin ceasefire peace talks negotiations Ukraine 2025",
      "Russia Ukraine peace proposal Kremlin statement"
    ]
  },
  {
    id: "RU_REAR_STRIKES", name: "Russian Rear Strikes & Economy", weight: 4,
    queries: [
      "Russia economy sanctions oil revenue budget 2025",
      "Ukraine drone strike Russia refinery depot"
    ]
  },
  {
    id: "RU_BUDGET_MOB", name: "Russian Budget/Mobilization", weight: 5,
    queries: [
      "Russia military budget mobilization conscription 2025",
      "Russia defense spending Duma budget"
    ]
  },
  {
    id: "G7_STATEMENTS", name: "G7 / White House Statements", weight: 2,
    queries: [
      "G7 Ukraine support White House statement 2025",
      "NATO Ukraine peace ceasefire diplomatic"
    ]
  },
  {
    id: "OSINT_TELEGRAM", name: "OSINT Telegram Channels", weight: 1,
    queries: [
      "Ukraine OSINT war update Telegram channel summary",
      "Ukraine conflict update news today"
    ]
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${b(BOLD_LINE)}`);
  console.log(`${C.bold}${C.cyan}  Peace Index 180 — Google News RSS Diagnostic${C.reset}`);
  console.log(`${b(BOLD_LINE)}`);
  console.log(d(`  Testing ${MARKERS.length} markers × up to 2 queries each`));
  console.log(d("  NO database calls. NO AI calls. Shows what data arrives per marker.\n"));

  let totalOk = 0, totalEmpty = 0, totalError = 0;
  const summary: { id: string; name: string; weight: number; found: number; status: string }[] = [];

  for (const marker of MARKERS) {
    const allItems: NewsItem[] = [];
    const queryResults: { query: string; found: number; error?: string }[] = [];

    for (const query of marker.queries) {
      const res = await fetchGoogleNews(query, 4);
      queryResults.push({ query, found: res.items.length, error: res.error });
      allItems.push(...res.items);
      // Deduplicate by URL
      const seen = new Set<string>();
      const unique = allItems.filter(i => !seen.has(i.url) && seen.add(i.url));
      allItems.length = 0;
      allItems.push(...unique);
      // Small pause so we don't hammer Google News
      await new Promise(r => setTimeout(r, 600));
    }

    const found = allItems.length;
    let statusLabel: string;
    if (found === 0 && queryResults.some(q => q.error)) {
      statusLabel = "ERROR";
      totalError++;
    } else if (found === 0) {
      statusLabel = "EMPTY";
      totalEmpty++;
    } else {
      statusLabel = "OK";
      totalOk++;
    }
    summary.push({ id: marker.id, name: marker.name, weight: marker.weight, found, status: statusLabel });

    // Print marker header
    const badge = statusLabel === "OK" ? g(`✓ ${found} items`) : statusLabel === "EMPTY" ? y("⚠ 0 items") : r("✗ error");
    console.log(`\n  ${b(marker.id)}  ${d(`w=${marker.weight}`)}  ${badge}`);
    console.log(`  ${d(marker.name)}`);

    for (const qr of queryResults) {
      const qBadge = qr.error ? r(`error: ${qr.error}`) : qr.found > 0 ? g(`${qr.found} items`) : y("0 items");
      console.log(`    ${d("query:")} "${qr.query}"  →  ${qBadge}`);
    }

    if (found > 0) {
      console.log(`    ${d("Latest headlines:")}`);
      for (const item of allItems.slice(0, 3)) {
        console.log(`      ${C.gray}${item.date}  ${item.source}${C.reset}`);
        console.log(`      ${item.title.slice(0, 80)}`);
      }
    } else {
      console.log(`    ${r("No news found for this marker with either query.")}`);
      console.log(`    ${y("→ Gemini will receive empty INPUT_DATA → will score 0% → wastes 1 RPD token")}`);
    }
  }

  // Summary table
  console.log(`\n\n${b(BOLD_LINE)}`);
  console.log(`${b("  Summary Table")}`);
  console.log(`${b(BOLD_LINE)}`);
  console.log(`  ${"MARKER".padEnd(30)} ${"W".padStart(2)}  ${"ITEMS".padStart(5)}  STATUS`);
  console.log(`  ${"─".repeat(55)}`);

  for (const s of summary) {
    const wt = String(s.weight).padStart(2);
    const found = String(s.found).padStart(5);
    let badge: string;
    if (s.status === "OK")    badge = g("✓ ok");
    else if (s.status === "EMPTY") badge = y("⚠ empty — will score 0%, wastes Gemini call");
    else                      badge = r("✗ error");
    console.log(`  ${s.id.padEnd(30)} ${wt}  ${s.status === "OK" ? g(found) : y(found)}  ${badge}`);
  }

  const savedTokens = totalEmpty + totalError;
  console.log(`\n  ${g(`✓ ${totalOk}`)} markers have news data`);
  console.log(`  ${y(`⚠ ${totalEmpty}`)} markers are empty (no news found with current queries)`);
  console.log(`  ${r(`✗ ${totalError}`)} markers errored`);
  if (savedTokens > 0) {
    console.log(`\n  ${b("Potential RPD savings:")} by skipping empty markers, each daily run`);
    console.log(`  would use ${b(`${17 - savedTokens + 1} Gemini calls`)} instead of 18 (17 + 1 aggregate).`);
    console.log(`  ${b(`Saves ${savedTokens} RPD tokens per day`)} on the free-tier budget.`);
  }

  console.log(`\n  ${b("Next steps:")}`);
  if (totalEmpty > 0) {
    console.log(`  1. ${y("Fix empty markers:")} try different search queries in your analyzer.ts`);
    console.log(`     More specific queries often work better, e.g.:`);
    console.log(`     ${d('"Ukraine IMF tranche 2025"')} instead of ${d('"Ukraine IMF program"')}`);
  }
  console.log(`  2. ${b("Critical fix in analyzer.ts:")} skip Gemini call when events.length === 0`);
  console.log(`     → avoids burning RPD on guaranteed-0% results`);
  console.log(`  3. ${b("Run diagnose-db.ts")} to see what's currently stored in the database`);
  console.log(`     ${d("bun run scripts/diagnose-db.ts")}\n`);

  console.log(`${b(BOLD_LINE)}\n`);
}

main().catch(err => {
  console.error(r("Fatal:"), err);
  process.exit(1);
});
