-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "observacionSync" TEXT,
ADD COLUMN     "origenOffline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiereRevision" BOOLEAN NOT NULL DEFAULT false;

