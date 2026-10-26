-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "fiadoHabilitado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- Hasta ahora "tener límite de crédito" significaba "puede comprar fiado".
-- Se conserva ese significado para los clientes existentes.
UPDATE "Cliente" SET "fiadoHabilitado" = true WHERE "limiteCredito" IS NOT NULL;
