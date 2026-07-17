-- AlterTable
ALTER TABLE "project_documents" DROP COLUMN "content",
ADD COLUMN     "contentHtml" TEXT;
