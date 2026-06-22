# Инструкция по деплою на Vercel

> Подробное пошаговое руководство для некоммерческого проекта «Индекс Мира 180».
> Все используемые сервисы имеют бесплатные тарифы.

---

## Что понадобится (всё бесплатно)

| Сервис | Зачем | Бесплатный лимит |
|---|---|---|
| **GitHub** | Хранение кода + ежедневный cron | Безлимит для публичных репозиториев |
| **Vercel** | Хостинг веб-приложения | Hobby план: безлимит деплоев |
| **Neon** | База данных PostgreSQL | Free: 0.5 GB, 1 проект |
| **Google Gemini** | ИИ-аналитика (LLM) | Free: 500 запросов/день, 15 RPM |

> **Важно:** Для работы нужны только **2** переменные окружения:
> `DATABASE_URL` (Neon) и `GEMINI_API_KEY` (Google AI Studio).

---

## Шаг 0. Подготовка кода

### 0.1. Установите Git и Node.js
- Git: https://git-scm.com/downloads
- Node.js (LTS ≥ 20): https://nodejs.org

### 0.2. Смените SQLite → PostgreSQL

Откройте файл `prisma/schema.prisma`. Найдите строку:
```
  provider = "sqlite"
```
Замените на:
```
  provider = "postgresql"
```
Сохраните файл.

---

## Шаг 1. Регистрация на сервисах

### 1.1. GitHub
1. https://github.com → **Sign up**

### 1.2. Vercel
1. https://vercel.com → **Sign Up** → **Continue with GitHub**

### 1.3. Neon (база данных)
1. https://neon.tech → **Sign up with GitHub**
2. **New Project** → имя: `peace-index` → Region: Frankfurt → **Create**
3. Скопируйте строку подключения:
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Это ваш **`DATABASE_URL`**

### 1.4. Google Gemini API (ИИ) ⭐ ГЛАВНОЕ
1. Зайдите на **https://aistudio.google.com/apikey**
2. Войдите в аккаунт Google
3. Нажмите **Create API key**
4. Скопируйте ключ (начинается с `AIza...`) — это ваш **`GEMINI_API_KEY`**
5. **Бесплатно**: 500 запросов в день, 15 запросов в минуту
   (приложение использует ~18 запросов в день — огромный запас)

> Используется модель **gemini-2.5-flash-lite** — самая лёгкая и быстрая.
> Сменить модель можно через переменную `GEMINI_MODEL`.

---

## Шаг 2. Загрузка кода на GitHub

### 2.1. Создайте репозиторий
GitHub → **+** → **New repository** → имя: `peace-index-180` → **Public** → **Create**

### 2.2. Инициализируйте Git и отправьте код
В терминале в папке проекта:
```
git init
git add .
git commit -m "Initial commit: Peace Index 180"
git remote add origin https://github.com/ВАШ_ЛОГИН/peace-index-180.git
git branch -M main
git push -u origin main
```

> Если спросит пароль — используйте **Personal Access Token**:
> GitHub → Settings → Developer settings → Personal access tokens → Generate (галка `repo`)

---

## Шаг 3. Секреты GitHub (для ежедневного пересчёта)

1. Репозиторий → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** — добавьте 2 секрета:

| Name | Value |
|---|---|
| `DATABASE_URL` | строка подключения из Neon (Шаг 1.3) |
| `GEMINI_API_KEY` | ключ Google Gemini (Шаг 1.4) |

> ❌ Не добавляйте `ZAI_API_KEY`, `ZAI_BASE_URL`, `ZAI_TOKEN` — они больше не нужны.
> Мы перешли с z.ai на Google Gemini.

---

## Шаг 4. Деплой на Vercel

### 4.1. Импорт
1. https://vercel.com/dashboard → **Add New…** → **Project**
2. Найдите `peace-index-180` → **Import**

### 4.2. Переменные окружения
В разделе **Environment Variables** добавьте 2 переменные:

| Key | Value |
|---|---|
| `DATABASE_URL` | строка подключения из Neon |
| `GEMINI_API_KEY` | ключ Google Gemini |

### 4.3. Деплой
Нажмите **Deploy** → подождите 2–3 минуты → «Congratulations!»

---

## Шаг 5. Первый пересчёт (через GitHub Actions)

> Кнопка «Обновить данные» на Vercel может не работать (лимит 60 секунд).
> Поэтому первый пересчёт делаем через GitHub Actions.

1. Репозиторий → вкладка **Actions**
2. Слева → **Daily Recalculation**
3. **Run workflow** → **Run workflow**
4. Подождите 3–5 минут (зелёная галочка = успех)
5. Откройте сайт на Vercel → обновите страницу → данные появились!

После этого пересчёт будет запускаться **автоматически каждый день в 02:00 UTC**.

---

## Шаг 6. Локальный запуск (опционально)

### 6.1. Установите зависимости
```
npm install
```

### 6.2. Создайте файл `.env` в корне:
```
DATABASE_URL=строка_из_Neon
GEMINI_API_KEY=ваш_ключ_gemini
```

### 6.3. Инициализируйте БД и запустите:
```
npm run db:push
npm run dev
```
Откройте http://localhost:3000

---

## Архитектура после деплоя

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Vercel (UI)       │────▶│   Neon (Postgres) │◀────│  GitHub     │
│   peace-index-180   │     │   База данных     │     │  Actions    │
│   .vercel.app       │     │                    │     │  cron 02:00 │
│                     │     │ • raw_events      │     │             │
│ • Спидометр         │     │ • marker_scores   │     │ ИИ-анализ   │
│ • Карточки маркеров │     │ • aggregates      │     │ + Google    │
│ • История           │     │                    │     │   Search    │
│ • Перевод (Gemini)  │     │                    │     │ Агрегация   │
└─────────────────────┘     └──────────────────┘     └─────────────┘
         │                                                    │
         └──── Google Gemini API (LLM + Search) ◀────────────┘
```

- **Vercel** — отображение + перевод (быстрые запросы < 60s)
- **GitHub Actions** — ежедневный пересчёт (2–3 мин, бесплатно для public repo)
- **Neon** — общая база PostgreSQL
- **Google Gemini** — LLM-аналитика + Google Search (grounding)
  - Анализ маркеров: `gemini-2.5-flash` с google_search
  - Агрегация/перевод: `gemini-2.5-flash-lite`

---

## Возможные проблемы

| Проблема | Решение |
|---|---|
| Vercel: «Build failed» | Проверьте `provider = "postgresql"` в `prisma/schema.prisma` |
| Vercel: «Prisma Client not found» | `postinstall: prisma generate` уже в package.json |
| Кнопка «Обновить данные» → таймаут | Нормально на Vercel (60s лимит). Используйте GitHub Actions |
| Actions: «GEMINI_API_KEY not set» | Добавьте секрет в Settings → Secrets (Шаг 3) |
| Actions: «Gemini API error 400» | Проверьте, что ключ из Google AI Studio действителен |
| Actions: «Unknown Model» | Сменилась модель; задайте `GEMINI_MODEL=gemini-2.5-flash` |
| Actions: «429 Resource Exhausted» | Превышен лимит Gemini (500/день). Подождите до завтра |
| Сайт показывает «Данных пока нет» | Запустите GitHub Actions workflow (Шаг 5) |
| Сайт пустой после деплоя | Подождите 2 минуты после зелёной галочки Actions, обновите |

---

## Расход лимитов Gemini

| Операция | Модель | Запросов | Когда |
|---|---|---|---|
| Анализ 17 маркеров (с Google Search) | gemini-2.5-flash | 17 | 1 раз в день (cron) |
| Агрегация | gemini-2.5-flash-lite | 1 | 1 раз в день |
| **Итого пересчёт** | | **18** | в день |
| Перевод обоснования | gemini-2.5-flash-lite | 1 | по клику пользователя |
| Перевод сводки | gemini-2.5-flash-lite | 1 | по клику пользователя |

- Дневной лимит Gemini Free: **500 запросов/день** на каждую модель
- Пересчёт: 18 запросов (3.6% лимита)
- **Запас: огромный**

---

## Если что-то не работает

1. Откройте вкладку **Actions** на GitHub → нажмите на последний запуск → посмотрите логи
2. В логах ищите строку `AI mode:` — должна быть `Google Gemini API (model: gemini-2.5-flash-lite)`
3. Если `UNKNOWN — no API key set` → не задан `GEMINI_API_KEY`
4. Проверьте, что ключ Gemini действителен на https://aistudio.google.com/apikey
5. Проверьте, что в Neon база доступна (вкладка Dashboard в Neon)
