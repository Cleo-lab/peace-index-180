/// RSS-коллектор — собирает свежие новости через Google News RSS.
/// Google News RSS бесплатен, не блокируется на серверах (GitHub Actions, Vercel),
/// и покрывает все 17 маркеров.
///
/// Формат: https://news.google.com/rss/search?q=QUERY&hl=en&gl=US&ceid=US:en
/// Возвращает XML с <item> элементами (title, link, pubDate, description).

export interface NewsItem {
  title: string;
  url: string;
  date: Date;
  source: string;
  snippet: string;
}

/// Получает новости через Google News RSS по поисковому запросу.
export async function fetchGoogleNewsRSS(
  query: string,
  maxItems = 8,
): Promise<NewsItem[]> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en&gl=US&ceid=US:en`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[rss] Google News HTTP ${res.status} for: ${query}`);
      return [];
    }

    const xml = await res.text();
    return parseRSSXml(xml, maxItems);
  } catch (err) {
    console.error(`[rss] fetch failed for "${query}":`, err);
    return [];
  }
}

/// Простой XML-парсер для RSS (без зависимостей).
/// Извлекает <item> элементы с title, link, pubDate, description.
function parseRSSXml(xml: string, maxItems: number): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  // Извлекаем максимум до 40 статей для последующей сортировки по свежести
  while ((match = itemRegex.exec(xml)) !== null && items.length < 40) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDateStr = extractTag(block, "pubDate");
    const desc = extractTag(block, "description");

    // Очищаем HTML-entities и теги в description
    const cleanDesc = decodeEntities(stripTags(desc)).trim();
    const cleanTitle = decodeEntities(title).trim();

    if (!cleanTitle || !link) continue;

    // Извлекаем источник из <source> тега или из URL
    const sourceTag = extractTag(block, "source");
    let source = sourceTag || "Google News";
    if (!sourceTag) {
      try {
        source = new URL(link).hostname.replace("www.", "");
      } catch {
        source = "unknown";
      }
    }

    const date = pubDateStr ? new Date(pubDateStr) : new Date();
    if (isNaN(date.getTime())) {
      // Google News иногда возвращает невалидные даты
      continue;
    }

    items.push({
      title: cleanTitle,
      url: link,
      date,
      source,
      snippet: cleanDesc || cleanTitle,
    });
  }

  // СОРТИРОВКА: Располагаем новости от самых свежих к более старым
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Возвращаем строго запрошенное количество самых актуальных новостей
  return items.slice(0, maxItems);
}

function extractTag(xml: string, tag: string): string {
  //CDATA-safe extraction
  const cdataRegex = new RegExp(
    `<${tag}[\\s\\S]*?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    "i",
  );
  const m = xml.match(cdataRegex);
  return m ? (m[1] || m[2] || "").trim() : "";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}
