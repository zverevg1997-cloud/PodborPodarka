-- Отбор разделов при загрузке выгрузки: у больших магазинов в подарок
-- годится малая часть каталога.
ALTER TABLE "product_feeds" ADD COLUMN "include" TEXT;
