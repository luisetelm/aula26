-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "emailDomain" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "joinCode" TEXT;
-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Seat_subjectId_idx" ON "Seat"("subjectId");
-- CreateIndex
CREATE UNIQUE INDEX "Seat_subjectId_userId_key" ON "Seat"("subjectId", "userId");
-- CreateIndex
CREATE UNIQUE INDEX "Subject_joinCode_key" ON "Subject"("joinCode");
-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Como el resto de tablas: RLS activado y sin políticas (solo accede el servidor).
ALTER TABLE "Seat" ENABLE ROW LEVEL SECURITY;
