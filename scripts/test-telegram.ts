// scripts/test-telegram.ts
//
// Быстрая точечная проверка: реально ли работает скрапинг Telegram-каналов
// (t.me/s/<канал>) для маркера UKR_MOBILIZATION — без полного пересчёта,
// без обращений к Gemini, без записи в БД.
//
// Запуск:  bun run scripts/test-telegram.ts

import { fetchTelegramChannels } from "@/lib/rss";

async function main() {
  console.log("Проверяю Telegram-источники для маркера UKR_MOBILIZATION...\n");

  const items = await fetchTelegramChannels("UKR_MOBILIZATION", 12);

  if (items.length === 0) {
    console.log("❌ Ничего не получено ни с одного канала.");
    console.log("\nВозможные причины:");
    console.log("  - Telegram поменял вёрстку страницы t.me/s/<канал> (парсинг устарел)");
    console.log("  - У каналов сейчас нет сообщений с текстом (только фото/видео без подписи)");
    console.log("  - Сеть/файрвол блокирует запрос к t.me (редко, но возможно)");
    console.log("\nПопробуйте открыть в браузере вручную для сравнения:");
    console.log("  https://t.me/s/kindzadza_ua");
    console.log("  https://t.me/s/stranaua");
    return;
  }

  console.log(`✅ Получено ${items.length} сообщений (после дедупликации и сортировки по дате):\n`);

  for (const item of items) {
    console.log(`[${item.date.toISOString().slice(0, 16).replace("T", " ")}] ${item.source}`);
    console.log(`  ${item.title}`);
    console.log(`  ${item.url}`);
    console.log("");
  }

  // Небольшая сводка по каналам — сколько сообщений реально пришло от каждого
  const byChannel = new Map<string, number>();
  for (const item of items) {
    byChannel.set(item.source, (byChannel.get(item.source) ?? 0) + 1);
  }
  console.log("Сводка по каналам:");
  for (const [source, count] of byChannel) {
    console.log(`  ${source}: ${count} сообщений`);
  }
}

main().catch((err) => {
  console.error("Ошибка при выполнении скрипта:", err);
  process.exit(1);
});
