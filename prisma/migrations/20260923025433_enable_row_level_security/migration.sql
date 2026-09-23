-- Закрываем таблицы от публичного REST API Supabase.
--
-- Supabase раздаёт схему public наружу через PostgREST по адресу
-- <project>.supabase.co/rest/v1/. Доступ к нему открывается публикуемым
-- ключом, который по замыслу не является секретом. Таблицы, созданные
-- Prisma, получали права ролей anon и authenticated автоматически, и в
-- результате любой, у кого есть адрес проекта и этот ключ, мог читать
-- и изменять почту пользователей, анкеты получателей и историю запросов.
--
-- На работу приложения это не влияет: оно ходит в базу через Prisma под
-- ролью postgres, а владелец таблицы политики RLS обходит.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "searches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registration_attempts" ENABLE ROW LEVEL SECURITY;

-- Политик намеренно не добавляем: при включённом RLS и отсутствии политик
-- любой запрос через PostgREST не вернёт ни одной строки.

-- Вторая линия обороны: снимаем сами права. Даже если когда-нибудь появится
-- политика, доступа через публичный REST быть не должно.
REVOKE ALL ON "users" FROM anon, authenticated;
REVOKE ALL ON "profiles" FROM anon, authenticated;
REVOKE ALL ON "searches" FROM anon, authenticated;
REVOKE ALL ON "registration_attempts" FROM anon, authenticated;

-- Чтобы будущие таблицы, которые создаст Prisma, не получали те же права
-- автоматически и дыра не открылась заново при следующей миграции.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
