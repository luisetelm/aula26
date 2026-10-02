-- CreateEnum
CREATE TYPE "OAuthTokenKind" AS ENUM ('ACCESS', 'REFRESH');

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "draftFeedback" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "draftGrade" DOUBLE PRECISION,
ADD COLUMN     "draftedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "OAuthTokenKind" NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthCode_codeHash_key" ON "OAuthCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_tokenHash_key" ON "OAuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OAuthToken_userId_idx" ON "OAuthToken"("userId");

-- AddForeignKey
ALTER TABLE "OAuthCode" ADD CONSTRAINT "OAuthCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthCode" ADD CONSTRAINT "OAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Como el resto de tablas: RLS activado y sin políticas (solo accede el servidor).
ALTER TABLE "OAuthClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthToken" ENABLE ROW LEVEL SECURITY;
