# Daribot

Сервис подбора подарков: пользователь заполняет анкету о получателе и поводе,
сервис предлагает несколько идей подарка с обоснованием и поисковым запросом.

Стек: Next.js (App Router, TypeScript) · Tailwind CSS · Prisma · PostgreSQL
(Supabase) · Supabase Auth.

## Структура

- `prisma/schema.prisma` — модели `User`, `Profile` (профиль получателя),
  `Search` (запрос на подбор + результат).
- `src/app/api/auth/*` — регистрация/вход/выход через Supabase Auth.
- `src/app/api/profiles` — CRUD профилей получателей.
- `src/app/api/recommend` — принимает анкету, отдаёт идеи подарка. Сейчас
  использует `src/lib/mockRecommend.ts` — заглушку с захардкоженными идеями
  вместо реального вызова Claude API (см. TODO в файле).
- `src/app/api/searches` — история поисков.
- Страницы: `/register`, `/login`, `/search` (анкета), `/results`,
  `/profile` (кабинет: сохранённые профили + история).

## Локальный запуск

1. Установите зависимости:

   ```bash
   npm install
   ```

2. Скопируйте `.env.example` в `.env` и заполните переменные:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — строка подключения к базе Supabase Postgres
     (Project Settings → Database → Connection string → URI).
   - `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` — из
     Project Settings → API. Нужны для регистрации/входа (Supabase Auth).
   - Остальные переменные (`ANTHROPIC_API_KEY`, `NEXTAUTH_SECRET`,
     `TELEGRAM_BOT_TOKEN`) пока не используются каркасом — задел под
     следующие шаги.

3. Примените Prisma-схему к базе данных:

   ```bash
   npx prisma migrate dev --name init
   ```

   (или `npx prisma db push` для быстрого прототипирования без миграций)

4. Запустите dev-сервер:

   ```bash
   npm run dev
   ```

   Приложение будет доступно на [http://localhost:3000](http://localhost:3000).

Полезные команды Prisma:

- `npx prisma studio` — визуальный просмотр/редактирование данных.
- `npx prisma generate` — перегенерировать Prisma Client после изменения схемы.

## Порядок разработки (что сделано / что дальше)

Сделано в каркасе:

- Структура проекта, модели данных, API-роуты, страницы.
- `/api/recommend` работает end-to-end на фиктивных идеях подарка.
- Аутентификация через Supabase Auth (email+пароль), защищённые роуты
  через middleware.

Следующие шаги (не входят в этот каркас):

- Подключить реальный вызов Claude API в `/api/recommend` вместо
  `mockRecommend()`: собрать промпт из данных анкеты, распарсить ответ в
  формат `GiftIdea[]`.
- Добавить вход через Telegram.
- Подключить каталог товаров через CPA-сеть (модель `Product`).
