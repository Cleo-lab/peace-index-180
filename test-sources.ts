import { fetchGoogleNewsRSS } from "./src/lib/rss";

async function test() {
  const queries = [
    { id: "M2_WRI", q: `MIGA DFC war risk insurance Ukraine long-term guarantee investment facility 2025 2026 coverage` },
    { id: "M8_PROZORRO", q: `Prozorro Sale Ukraine large privatization state assets tender auction 2025 2026 successful` },
    { id: "M10_CONCESSION", q: `Ukraine infrastructure reform port railway concession 2025 2026` },
    { id: "M14_ZELENSKY", q: `Zelensky threat warning Belarus Poland Lukashenko sharp statement escalation 2025 2026` },
  ];

  for (const { id, q } of queries) {
    console.log(`\n=== ${id} ===`);
    const items = await fetchGoogleNewsRSS(q, 5);
    items.forEach((it, i) => {
      console.log(`${i + 1}. ${it.title} [${it.source}]`);
    });
    if (items.length === 0) console.log("❌ Нет результатов");
    await new Promise(r => setTimeout(r, 500));
  }
}

test();
