-- Сообщества, за которыми следим, и найденные в них взлетевшие записи.
CREATE TABLE "trend_sources" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'vk',
    "handle" TEXT NOT NULL,
    "title" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "checkedAt" TIMESTAMP(3),
    "median" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trend_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trend_finds" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "median" INTEGER NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL,
    "topicKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trend_finds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trend_sources_network_handle_key" ON "trend_sources"("network", "handle");
CREATE UNIQUE INDEX "trend_finds_network_postId_key" ON "trend_finds"("network", "postId");
CREATE INDEX "trend_finds_foundAt_idx" ON "trend_finds"("foundAt");
CREATE INDEX "trend_finds_topicKey_foundAt_idx" ON "trend_finds"("topicKey", "foundAt");

ALTER TABLE "trend_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trend_finds" ENABLE ROW LEVEL SECURITY;
