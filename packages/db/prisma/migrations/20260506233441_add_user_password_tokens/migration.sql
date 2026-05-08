-- CreateTable
CREATE TABLE "UserPasswordToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "activeKey" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdById" TEXT,
    "revokedById" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPasswordToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPasswordToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPasswordToken_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPasswordToken_tokenHash_key" ON "UserPasswordToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserPasswordToken_activeKey_key" ON "UserPasswordToken"("activeKey");

-- CreateIndex
CREATE INDEX "UserPasswordToken_userId_purpose_expiresAt_idx" ON "UserPasswordToken"("userId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "UserPasswordToken_userId_purpose_usedAt_revokedAt_idx" ON "UserPasswordToken"("userId", "purpose", "usedAt", "revokedAt");

-- CreateIndex
CREATE INDEX "UserPasswordToken_purpose_expiresAt_idx" ON "UserPasswordToken"("purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "UserPasswordToken_createdById_idx" ON "UserPasswordToken"("createdById");

-- CreateIndex
CREATE INDEX "UserPasswordToken_revokedById_idx" ON "UserPasswordToken"("revokedById");
