-- Значения, которые приложение меняет само: сейчас это токен ВКонтакте,
-- который живёт час и продлевается по refresh_token.
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
