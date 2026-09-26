-- Товарные выгрузки партнёрских магазинов и товары из них.
CREATE TABLE "product_feeds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" TIMESTAMP(3),
    "count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_feeds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "price" INTEGER NOT NULL,
    "oldPrice" INTEGER,
    "url" TEXT NOT NULL,
    "picture" TEXT NOT NULL,
    "category" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_feedId_externalId_key" ON "products"("feedId", "externalId");
CREATE INDEX "products_available_price_idx" ON "products"("available", "price");
CREATE INDEX "products_category_idx" ON "products"("category");

ALTER TABLE "products" ADD CONSTRAINT "products_feedId_fkey"
    FOREIGN KEY ("feedId") REFERENCES "product_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_feeds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
