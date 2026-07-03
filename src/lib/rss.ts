/// RSS-коллектор — собирает свежие новости через Google News RSS.
/// Google News RSS бесплатен, не блокируется на серверах (GitHub Actions, Vercel),
/// и покрывает все 24 маркера.
///
/// Формат: https://news.google.com/rss/search?q=QUERY&hl=en&gl=US&ceid=US:en
/// Возвращает XML с <item> элементами (title, link, pubDate, description).
/// Retry-утилита для fetch
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 2000,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.log(`[rss] retry after ${delayMs}ms...`);
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithRetry(fn, retries - 1, delayMs);
  }
}
export interface NewsItem {
  title: string;
  url: string;
  date: Date;
  source: string;
  snippet: string;
  /// Релевантность к запросу (0-1), вычисляется по ключевым словам
  relevance: number;
}

/// Пауза между запросами к RSS (ms)
const RSS_DELAY_MS = 300;

/// Получает новости через Google News RSS по поисковому запросу.
export async function fetchGoogleNewsRSS(
  query: string,
  maxItems = 12,
): Promise<NewsItem[]> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en&gl=US&ceid=US:en`;

    try {
    const res = await fetchWithRetry(() => fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
    }))

    if (!res.ok) {
      console.error(`[rss] Google News HTTP ${res.status} for: ${query}`);
      return [];
    }

    const xml = await res.text();
    return parseRSSXml(xml, maxItems, query);
  } catch (err) {
    console.error(`[rss] fetch failed for "${query}":`, err);
    return [];
  }
}

/// Fallback: NewsAPI через RSS-агрегатор (если Google News недоступен)
export async function fetchNewsAPIFallback(
  query: string,
  maxItems = 12,
): Promise<NewsItem[]> {
  if (!process.env.NEWSAPI_KEY) return [];
  
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=${maxItems}&apiKey=${process.env.NEWSAPI_KEY}`;
  
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    
    const data = await res.json() as {
      articles?: Array<{
        title: string;
        url: string;
        publishedAt: string;
        source?: { name: string };
        description?: string;
      }>;
    };
    
    return (data.articles ?? []).map((a) => ({
      title: a.title || "Untitled",
      url: a.url,
      date: new Date(a.publishedAt),
      source: a.source?.name || "NewsAPI",
      snippet: a.description || a.title || "",
      relevance: 0.5,
    }));
  } catch {
    return [];
  }
}

/// Простой XML-парсер для RSS (без зависимостей).
/// Извлекает <item> элементы с title, link, pubDate, description.
function parseRSSXml(xml: string, maxItems: number, query: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  // Извлекаем максимум до 50 статей для последующей сортировки по релевантности
  while ((match = itemRegex.exec(xml)) !== null && items.length < 50) {
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

    // Вычисляем релевантность по ключевым словам запроса
    const relevance = calculateRelevance(cleanTitle + " " + cleanDesc, query);

    items.push({
      title: cleanTitle,
      url: link,
      date,
      source,
      snippet: cleanDesc || cleanTitle,
      relevance,
    });
  }

  // СОРТИРОВКА: порог "действительно по теме" + чистая сортировка по дате внутри него.
  //
  // Предыдущая версия использовала смешанный балл (55% релевантность + 45% свежесть),
  // но на реальном инциденте это не сработало: старая статья с очень плотным
  // совпадением по ключевым словам (~0.85) всё равно обгоняла свежую, но менее
  // "дословно" совпадающую статью про сегодняшнее событие (~0.42 релевантность,
  // 0.93 свежести) — 0.76 против 0.65. Блендинг слишком мягкий, когда разрыв
  // в релевантности большой, а именно так часто бывает: устоявшийся нарратив
  // переиспользует формулировки поискового запроса лучше, чем горячая новость.
  //
  // Новый подход решительнее: сначала отсекаем совсем нерелевантный шум (порог),
  // а среди всего, что прошло порог — то есть "действительно по теме" — дальше
  // рулит ТОЛЬКО дата. Самая свежая статья по теме всегда побеждает более старую
  // по теме, независимо от того, насколько плотнее она совпадает по словам.
  const RELEVANCE_FLOOR = 0.35;
  const passesFloor = items.filter((i) => i.relevance >= RELEVANCE_FLOOR);
  // Защита от узких/нишевых маркеров: если порог отсёк почти всё (осталось меньше
  // 5 статей), не рискуем остаться совсем без данных — используем полный список.
  const pool = passesFloor.length >= Math.min(5, items.length) ? passesFloor : items;

  pool.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Возвращаем строго запрошенное количество самых свежих новостей по теме
  return pool.slice(0, maxItems);
}

/// Вычисляет релевантность новости к поисковому запросу (0-1)
function calculateRelevance(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !isStopWord(w));
  
  if (queryWords.length === 0) return 0.5;

  let matches = 0;
  let exactMatches = 0;
  
  for (const word of queryWords) {
    if (textLower.includes(word)) {
      matches++;
      // Бонус за точное совпадение фразы
      if (textLower.includes(word + " ")) exactMatches += 0.5;
    }
  }

  const baseScore = matches / queryWords.length;
  const exactBonus = exactMatches / queryWords.length;
  
  return Math.min(1, baseScore * 0.7 + exactBonus * 0.3 + 0.1);
}

/// Стоп-слова для фильтрации запроса
function isStopWord(word: string): boolean {
  const stops = new Set([
    "and", "the", "for", "with", "from", "that", "this", "have", "has",
    "been", "were", "are", "was", "will", "would", "could", "should",
    "news", "update", "latest", "report", "2025", "2026", "year",
  ]);
  return stops.has(word);
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

/// Универсальная функция сбора: пробует Google News RSS, затем NewsAPI fallback
export async function fetchNews(
  query: string,
  maxItems = 12,
): Promise<NewsItem[]> {
  // Сначала пробуем Google News RSS
  const rssItems = await fetchGoogleNewsRSS(query, maxItems);
  
  if (rssItems.length >= maxItems * 0.5) {
    // Достаточно данных от RSS
    return rssItems;
  }
  
  // Fallback на NewsAPI если мало данных
  console.log(`[rss] Google News returned ${rssItems.length} items for "${query}", trying fallback...`);
  const fallbackItems = await fetchNewsAPIFallback(query, maxItems);
  
  // Дедупликация по URL
  const seen = new Set(rssItems.map((i) => i.url));
  const uniqueFallback = fallbackItems.filter((i) => !seen.has(i.url));
  
  // Объединяем и сортируем по дате
  const combined = [...rssItems, ...uniqueFallback];
  combined.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  return combined.slice(0, maxItems);
}
/// Fallback-источники для конкретных маркеров (RSS-ленты)
const MARKER_FALLBACK_RSS: Record<string, string[]> = {
  RADA_FDI: [
    "https://www.rada.gov.ua/rss/news",          // Официальный сайт ВРУ
    "https://news.liga.net/ukr/rss.xml",          // ЛІГА.net
  ],
  CONCESSION_LAWS: [
    "https://www.rada.gov.ua/rss/news",
    "https://interfax.com.ua/news/economic/rss",  // Интерфакс-Украина экономика
  ],
  BELARUS_MOBIL: [
    "https://charter97.org/ru/rss/",              // Charter 97 (белорусская оппозиция)
  ],
  UKR_POLAND_DEMARCHE: [
    "https://www.polsatnews.pl/rss/polska.xml",    // Polsat News (Польша)
    "https://www.rmf24.pl/fakty/feed",             // RMF24 (Польша)
  ],
  OSINT_TELEGRAM: [
    // OSINT Telegram — парсим через Nitter-зеркала Twitter/X аккаунтов
    "https://nitter.net/WarMonitor3/rss",          // WarMonitor
    "https://nitter.net/DefMon3/rss",              // DefMon3
  ],
};

/// Парсит RSS по URL (универсальный fetcher)
export async function fetchRSSFeed(
  feedUrl: string,
  maxItems = 12,
): Promise<NewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[rss] RSS feed HTTP ${res.status}: ${feedUrl}`);
      return [];
    }

    const xml = await res.text();
    return parseRSSXml(xml, maxItems, ""); // query="" — релевантность будет базовой 0.5
  } catch (err) {
    console.warn(`[rss] RSS fetch failed: ${feedUrl}`, err);
    return [];
  }
}

/// Собирает новости для маркера: сначала Google News, потом fallback RSS
export async function fetchNewsWithFallback(
  markerId: string,
  query: string,
  maxItems = 12,
): Promise<NewsItem[]> {
  // 1. Основной источник — Google News RSS
  const googleNews = await fetchGoogleNewsRSS(query, maxItems);
  
  if (googleNews.length >= 3) {
    return googleNews; // Достаточно данных
  }

  console.log(`[fallback] ${markerId}: Google News дал ${googleNews.length}, пробуем RSS...`);

  // 2. Fallback RSS-источники
  const fallbackUrls = MARKER_FALLBACK_RSS[markerId] || [];
  const allItems: NewsItem[] = [...googleNews];

  for (const url of fallbackUrls) {
    try {
      const items = await fetchRSSFeed(url, maxItems);
      console.log(`[fallback] ${markerId}: ${url} → ${items.length} новостей`);
      allItems.push(...items);
      
      if (allItems.length >= maxItems) break;
    } catch (e) {
      console.warn(`[fallback] ${markerId}: ошибка ${url} —`, e);
    }
    
    // Небольшая пауза между fallback-запросами
    await new Promise(r => setTimeout(r, 200));
  }

  // Дедупликация по URL
  const seen = new Set<string>();
  const unique = allItems.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Сортируем по дате (свежие сверху)
  unique.sort((a, b) => b.date.getTime() - a.date.getTime());

  return unique.slice(0, maxItems);
}
/// Пакетный сбор новостей для нескольких запросов с задержкой
export async function fetchNewsBatch(
  queries: string[],
  maxItemsPerQuery = 12,
): Promise<Map<string, NewsItem[]>> {
  const results = new Map<string, NewsItem[]>();
  
  for (const query of queries) {
    const items = await fetchNews(query, maxItemsPerQuery);
    results.set(query, items);
    // Уважаем rate-limit
    await new Promise((r) => setTimeout(r, RSS_DELAY_MS));
  }
  
  return results;
}
