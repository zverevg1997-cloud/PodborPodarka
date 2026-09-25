-- Отметка о предупреждении, что к посту не приложена картинка.
ALTER TABLE "scheduled_posts" ADD COLUMN "warnedAt" TIMESTAMP(3);
