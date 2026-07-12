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

/// Основной источник новостей — Tavily Search API.
/// В отличие от Google News RSS, Tavily:
/// - сам оценивает релевантность (поле score) — не нужен наш грубый keyword-matching;
/// - поддерживает нативный фильтр по свежести (days) — для эскалационных маркеров
///   можно жёстко ограничить окно последними днями, не полагаясь на пересортировку.
/// search_depth: "basic" — 1 кредит за вызов (бесплатный лимит — 1000 кредитов/мес).
export async function fetchTavilyNews(
  query: string,
  maxItems = 12,
  daysWindow = 30,
): Promise<NewsItem[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        topic: "news",
        search_depth: "basic",
        max_results: maxItems,
        days: daysWindow,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[tavily] HTTP ${res.status} for: ${query}`);
      return [];
    }

    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
        published_date?: string;
      }>;
    };

    const items: NewsItem[] = (data.results ?? [])
      .filter((r) => r.title && r.url)
      .map((r) => {
        const date = r.published_date ? new Date(r.published_date) : new Date();
        let source = "unknown";
        try {
          source = new URL(r.url!).hostname.replace("www.", "");
        } catch {
          /* оставляем "unknown" */
        }
        return {
          title: r.title!.trim(),
          url: r.url!,
          date: isNaN(date.getTime()) ? new Date() : date,
          source,
          snippet: (r.content || r.title || "").trim(),
          relevance: typeof r.score === "number" ? Math.max(0, Math.min(1, r.score)) : 0.5,
        };
      });

    return items;
  } catch (err) {
    console.error(`[tavily] fetch failed for "${query}":`, err);
    return [];
  }
}

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

  // СОРТИРОВКА: Сначала по релевантности, потом по свежести
  // Комбинированный балл: свежесть весит почти наравне с релевантностью.
  // Раньше дата учитывалась только как тай-брейк при почти равной релевантности
  // (разница ≤0.15) — из-за этого хорошо проиндексированная, но недельной давности
  // статья систематически перебивала свежую, но чуть менее "плотную" по ключевым
  // словам. Для маркеров эскалации это критично: модель должна видеть СЕГОДНЯШНЕЕ
  // событие, а не пересказывать удар недельной давности только потому, что он лучше
  // попал в поисковый запрос.
  const now = Date.now();
  function combinedScore(relevance: number, date: Date): number {
    const daysOld = Math.max(0, (now - date.getTime()) / (1000 * 60 * 60 * 24));
    const recency = Math.exp(-daysOld / 14); // мягкий спад, "период полураспада" ~14 дней
    return relevance * 0.55 + recency * 0.45;
  }

  items.sort((a, b) => combinedScore(b.relevance, b.date) - combinedScore(a.relevance, a.date));

  // Возвращаем строго запрошенное количество самых релевантных новостей
  return items.slice(0, maxItems);
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

/// Универсальная функция сбора: Tavily (основной) → Google News RSS (резерв) → NewsAPI (последний резерв),
/// ПЛЮС Telegram-каналы (rsshub.app), если они сконфигурированы для конкретного markerId —
/// см. MARKER_TELEGRAM_CHANNELS ниже. Telegram-источники домешиваются ВСЕГДА, а не только
/// когда остальные источники дали мало данных: для некоторых тем (например, бусификация)
/// именно Telegram — основное место освещения, а не запасной вариант на крайний случай.
export async function fetchNews(
  query: string,
  maxItems = 12,
  daysWindow = 30,
  markerId?: string,
): Promise<NewsItem[]> {
  let result: NewsItem[] = [];

  // 1. Основной источник — Tavily (свежее, с собственной релевантностью)
  if (process.env.TAVILY_API_KEY) {
    try {
      const tavilyItems = await fetchTavilyNews(query, maxItems, daysWindow);
      if (tavilyItems.length >= Math.min(3, maxItems)) {
        console.log(`[tavily] OK — ${tavilyItems.length} items for "${query}"`);
        result = tavilyItems;
      } else {
        console.log(`[tavily] returned only ${tavilyItems.length} items for "${query}", falling back to RSS...`);
      }
    } catch (err) {
      console.error(`[tavily] unexpected error for "${query}":`, err);
    }
  } else {
    console.warn(`[tavily] TAVILY_API_KEY is not set — skipping Tavily, using Google News RSS only.`);
  }

  if (result.length === 0) {
    // 2. Резерв — Google News RSS (прежняя логика, без изменений)
    const rssItems = await fetchGoogleNewsRSS(query, maxItems);

    if (rssItems.length >= maxItems * 0.5) {
      // Достаточно данных от RSS
      result = rssItems;
    } else {
      // 3. Последний резерв — NewsAPI если мало данных
      console.log(`[rss] Google News returned ${rssItems.length} items for "${query}", trying fallback...`);
      const fallbackItems = await fetchNewsAPIFallback(query, maxItems);

      // Дедупликация по URL
      const seen = new Set(rssItems.map((i) => i.url));
      const uniqueFallback = fallbackItems.filter((i) => !seen.has(i.url));

      // Объединяем и сортируем по дате
      const combined = [...rssItems, ...uniqueFallback];
      combined.sort((a, b) => b.date.getTime() - a.date.getTime());

      result = combined.slice(0, maxItems);
    }
  }

  // 4. Telegram-каналы (полноценный источник, если сконфигурирован для этого маркера)
  if (markerId && MARKER_TELEGRAM_CHANNELS[markerId]?.length) {
    try {
      const telegramItems = await fetchTelegramChannels(markerId, maxItems);
      if (telegramItems.length > 0) {
        const seenUrls = new Set(result.map((i) => i.url));
        const uniqueTelegram = telegramItems.filter((i) => !seenUrls.has(i.url));
        result = [...result, ...uniqueTelegram];
        result.sort((a, b) => b.date.getTime() - a.date.getTime());
        result = result.slice(0, maxItems);
        console.log(`[telegram] ${markerId}: added ${uniqueTelegram.length} items, total now ${result.length}`);
      }
    } catch (err) {
      console.error(`[telegram] fetch failed for marker ${markerId}:`, err);
    }
  }

  return result;
}

/// Telegram-каналы, сконфигурированные как ПОЛНОЦЕННЫЙ источник (не запасной) для
/// конкретных маркеров — используется, когда тема слабо освещается англоязычными
/// источниками (Tavily/Google News), но активно обсуждается в украиноязычном Telegram.
///
/// ВАЖНО: изначально это шло через rsshub.app как прокси, но публичный демо-инстанс
/// RSSHub оказался ненадёжен (403 на оба канала — вероятно, троттлинг по IP на
/// бесплатном демо). Вместо стороннего прокси читаем НАПРЯМУЮ публичную
/// preview-страницу канала https://t.me/s/<username> — это официальная страница
/// Telegram для встраивания виджетов канала на сторонние сайты, открыта без логина
/// и без токенов. RSSHub под капотом делает ровно то же самое — просто нам не нужен
/// посредник, который сам может быть недоступен.
const MARKER_TELEGRAM_CHANNELS: Record<string, string[]> = {
  UKR_MOBILIZATION: ["kindzadza_ua", "stranaua"],
};

/// Скрапит один Telegram-канал через публичную preview-страницу (без токенов/API).
/// Формат страницы стабилен (используется многими встраиваемыми виджетами), но это
/// НЕ официальный API — если Telegram когда-нибудь поменяет вёрстку, парсинг вернёт
/// 0 сообщений (не упадёт с ошибкой) и это будет видно в логах по нулевым цифрам.
async function fetchTelegramChannelPreview(
  channelUsername: string,
  maxItems: number,
): Promise<NewsItem[]> {
  const url = `https://t.me/s/${channelUsername}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[telegram] HTTP ${res.status} for ${url}`);
      return [];
    }
    html = await res.text();
  } catch (err) {
    console.warn(`[telegram] fetch failed for ${url}:`, err);
    return [];
  }

  const items: NewsItem[] = [];
  // Каждое сообщение в разметке начинается с data-post="channel/12345" —
  // разбиваем HTML по этим границам, чтобы получить один "блок" на сообщение.
  const blocks = html.split(/(?=data-post="[^"]+")/);

  for (const block of blocks) {
    const postMatch = block.match(/data-post="([^"]+)"/);
    if (!postMatch) continue;
    const postId = postMatch[1]; // например "kindzadza_ua/4821"

    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const date = dateMatch ? new Date(dateMatch[1]) : new Date();

    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    );
    if (!textMatch) continue; // сообщение без текста (просто фото/видео без подписи)

    let text = textMatch[1]
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .trim();
    text = decodeEntities(text);
    if (!text) continue;

    items.push({
      title: text.slice(0, 160),
      url: `https://t.me/${postId}`,
      date: isNaN(date.getTime()) ? new Date() : date,
      source: `Telegram: @${channelUsername}`,
      snippet: text,
      relevance: 0.6, // канал целиком по теме — базовая релевантность чуть выше обычной
    });

    if (items.length >= maxItems) break;
  }

  return items;
}

/// Ключевые слова для фильтрации Telegram-постов по теме конкретного маркера.
/// Каналы в MARKER_TELEGRAM_CHANNELS — общие военно-политические, а не узко
/// специализированные "только про бусификацию", поэтому большинство их постов
/// не по теме и должны отсеиваться, иначе они разбавляют сигнал и могут вытеснить
/// релевантные результаты Tavily при сортировке по дате.
const TELEGRAM_TOPIC_KEYWORDS: Record<string, string[]> = {
  UKR_MOBILIZATION: [
    "тцк", "мобилизац", "мобіліза", "повестк", "повістк",
    "військкомат", "военкомат", "воєнкомат", "бусиф", "бзвп",
    "уклонист", "ухилянт", "рекрут", "затрим", "полюванн",
    "облав", "штурмов", "одноразк", "мобилизован", "мобілізован",
  ],
};

function matchesTopicKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/// Собирает новости из Telegram-каналов, сконфигурированных для данного маркера.
export async function fetchTelegramChannels(
  markerId: string,
  maxItems = 12,
): Promise<NewsItem[]> {
  const channels = MARKER_TELEGRAM_CHANNELS[markerId] || [];
  if (channels.length === 0) return [];

  const keywords = TELEGRAM_TOPIC_KEYWORDS[markerId];

  const all: NewsItem[] = [];
  for (const channel of channels) {
    try {
      // Берём с запасом (в разы больше maxItems) — канал общий, после фильтрации
      // по теме релевантным окажется лишь часть постов, иначе рискуем остаться
      // почти без данных для узкой темы на фоне общего потока новостей канала.
      const rawItems = await fetchTelegramChannelPreview(channel, maxItems * 4);
      const filtered = keywords
        ? rawItems.filter((item) => matchesTopicKeywords(item.snippet, keywords))
        : rawItems;
      console.log(
        `[telegram] ${markerId}: @${channel} → ${rawItems.length} постов всего, ${filtered.length} по теме`,
      );
      all.push(...filtered);
    } catch (e) {
      console.warn(`[telegram] ${markerId}: ошибка @${channel} —`, e);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Дедупликация по URL + сортировка по дате (свежие сверху)
  const seen = new Set<string>();
  const unique = all.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  unique.sort((a, b) => b.date.getTime() - a.date.getTime());
  return unique.slice(0, maxItems);
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
