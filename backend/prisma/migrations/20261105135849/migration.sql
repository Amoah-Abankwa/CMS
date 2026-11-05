-- CreateTable
CREATE TABLE "MfaEmailCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaEmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaEmailCode_userId_createdAt_idx" ON "MfaEmailCode"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MfaEmailCode" ADD CONSTRAINT "MfaEmailCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
