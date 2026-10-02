-- CreateEnum
CREATE TYPE "GradingMode" AS ENUM ('SCORE', 'COMPLETION');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "acceptsLink" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowedExtensions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gradingMode" "GradingMode" NOT NULL DEFAULT 'SCORE';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "url" TEXT NOT NULL DEFAULT '';

