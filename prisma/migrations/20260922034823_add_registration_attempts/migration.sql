-- CreateTable
CREATE TABLE "registration_attempts" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registration_attempts_ip_createdAt_idx" ON "registration_attempts"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "registration_attempts_createdAt_idx" ON "registration_attempts"("createdAt");
