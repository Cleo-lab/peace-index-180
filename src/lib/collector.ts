import { db } from "@/lib/db";
import { fetchNews, type NewsItem } from "@/lib/rss";
import { sleep } from "@/lib/ai";
import { MARKERS, type MarkerDef } from "@/lib/markers";

export interface CollectedEvent {
  markerId: string;
  eventDate: Date;
  sourceUrl: string;
  sourceName: string;
  rawText: string;
  /// Релевантность события к маркеру (0-1)
  relevance: number;
}

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/// Сбор данных для ОДНОГО маркера через веб-поиск (RSS + fallback).
/// Возвращает список событий и сохраняет их в БД (с дедупликацией по sourceUrl).
export async function collectMarker(marker: MarkerDef): Promise<CollectedEvent[]> {
  let items: NewsItem[] = [];
  try {
    items = await fetchNews(marker.searchQuery, 12, 30, marker.id);
  } catch (err) {
    console.error(`[collector] search failed for ${marker.id}:`, err);
    return [];
  }

  const events: CollectedEvent[] = [];
  const now = new Date();

  for (const it of items) {
    const url = it.url?.trim();
    if (!url) continue;
    const text = (it.snippet || it.title || "").trim();
    if (!text) continue;

    const eventDate = parseDate(it.date?.toISOString()) ?? now;
    events.push({
      markerId: marker.id,
      eventDate,
      sourceUrl: url,
      sourceName: it.source || "unknown",
      rawText: text,
      relevance: it.relevance || 0.5,
    });
  }

  // Дедупликация + сохранение в БД
  if (events.length > 0) {
    try {
      // Сортируем по релевантности (сначала самые релевантные)
      events.sort((a, b) => b.relevance - a.relevance);

      const seen = new Set<string>();
      const unique: CollectedEvent[] = [];
      for (const ev of events) {
        if (seen.has(ev.sourceUrl)) continue;
        seen.add(ev.sourceUrl);
        unique.push(ev);
      }

      const existing = await db.rawEvent.findMany({
        where: { sourceUrl: { in: unique.map((u) => u.sourceUrl) } },
        select: { sourceUrl: true },
      });
      const existingSet = new Set(existing.map((e) => e.sourceUrl));

      const toCreate = unique.filter((u) => !existingSet.has(u.sourceUrl));
      if (toCreate.length > 0) {
        await db.rawEvent.createMany({
          data: toCreate.map((ev) => ({
            markerId: ev.markerId,
            eventDate: ev.eventDate,
            sourceUrl: ev.sourceUrl,
            sourceName: ev.sourceName,
            rawText: ev.rawText,
            // relevance не хранится в схеме Prisma — можно добавить позже
          })),
        });
      }
      return unique;
    } catch (err) {
      console.error(`[collector] db save failed for ${marker.id}:`, err);
      return events;
    }
  }

  return events;
}

/// Возвращает события по маркеру за последние `days` дней (из БД).
/// Сортирует по релевантности (если доступно) и дате.
export async function getRecentEvents(
  markerId: string,
  days = 30,
): Promise<CollectedEvent[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db.rawEvent.findMany({
    where: { markerId, eventDate: { gte: since } },
    orderBy: { eventDate: "desc" },
    take: 15,
  });

  return rows.map((r) => ({
    markerId: r.markerId,
    eventDate: r.eventDate,
    sourceUrl: r.sourceUrl,
    sourceName: r.sourceName,
    rawText: r.rawText,
    relevance: 0.5, // Базовое значение для старых записей
  }));
}

/// Полный сбор по всем маркерам с паузами между запросами.
/// Сортирует маркеры по весу (высоковесные первыми) для приоритизации.
export async function collectAll(
  onProgress?: (marker: MarkerDef, count: number, idx: number, total: number) => void,
): Promise<void> {
  // Сортируем: сначала высоковесные (finance, law, escalation), потом остальные
  const sortedMarkers = [...MARKERS].sort((a, b) => b.weight - a.weight);
  const total = sortedMarkers.length;

  for (let i = 0; i < sortedMarkers.length; i++) {
    const marker = sortedMarkers[i];
    const events = await collectMarker(marker);
    onProgress?.(marker, events.length, i + 1, total);
    // Увеличили паузу с 400 до 500 мс из-за большего количества маркеров
    await sleep(500);
  }
}

/// Сбор по конкретной группе маркеров (для частичного обновления).
export async function collectGroup(
  groupKey: string,
  onProgress?: (marker: MarkerDef, count: number, idx: number, total: number) => void,
): Promise<void> {
  const groupMarkers = MARKERS.filter((m) => m.group === groupKey);
  const total = groupMarkers.length;

  for (let i = 0; i < groupMarkers.length; i++) {
    const marker = groupMarkers[i];
    const events = await collectMarker(marker);
    onProgress?.(marker, events.length, i + 1, total);
    await sleep(500);
  }
}

/// Экстренный сбор по маркерам эскалации (для быстрого реагирования на кризис).
export async function collectEscalationMarkers(
  onProgress?: (marker: MarkerDef, count: number) => void,
): Promise<CollectedEvent[]> {
  const escalationMarkers = MARKERS.filter((m) => m.group === "escalation");
  const allEvents: CollectedEvent[] = [];

  for (const marker of escalationMarkers) {
    const events = await collectMarker(marker);
    allEvents.push(...events);
    onProgress?.(marker, events.length);
    await sleep(300);
  }

  // Сортируем по релевантности и дате
  allEvents.sort((a, b) => {
    const relDiff = b.relevance - a.relevance;
    if (Math.abs(relDiff) > 0.1) return relDiff;
    return b.eventDate.getTime() - a.eventDate.getTime();
  });

  return allEvents;
}
