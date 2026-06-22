import { db } from "@/lib/db";
import { searchWeb, sleep, type SearchResult } from "@/lib/ai";
import { MARKERS, type MarkerDef } from "@/lib/markers";

export interface CollectedEvent {
  markerId: string;
  eventDate: Date;
  sourceUrl: string;
  sourceName: string;
  rawText: string;
}

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/// Сбор данных для ОДНОГО маркера через веб-поиск.
/// Возвращает список событий и сохраняет их в БД (с дедупликацией по sourceUrl).
export async function collectMarker(marker: MarkerDef): Promise<CollectedEvent[]> {
  let items: SearchResult[] = [];
  try {
    items = await searchWeb(marker.searchQuery, 8);
  } catch (err) {
    console.error(`[collector] search failed for ${marker.id}:`, err);
    return [];
  }

  const events: CollectedEvent[] = [];
  const now = new Date();

  for (const it of items) {
    const url = it.url?.trim();
    if (!url) continue;
    const text = (it.snippet || it.name || "").trim();
    if (!text) continue;

    const eventDate = parseDate(it.date) ?? now;
    events.push({
      markerId: marker.id,
      eventDate,
      sourceUrl: url,
      sourceName: it.host_name || it.name || "unknown",
      rawText: text,
    });
  }

  // Дедупликация + сохранение в БД
  if (events.length > 0) {
    try {
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
  }));
}

/// Полный сбор по всем маркерам с паузами между запросами.
export async function collectAll(
  onProgress?: (marker: MarkerDef, count: number, idx: number, total: number) => void,
): Promise<void> {
  const total = MARKERS.length;
  for (let i = 0; i < MARKERS.length; i++) {
    const marker = MARKERS[i];
    const events = await collectMarker(marker);
    onProgress?.(marker, events.length, i + 1, total);
    await sleep(400);
  }
}
