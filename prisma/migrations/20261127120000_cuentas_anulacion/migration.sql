-- AlterTable
ALTER TABLE "MovimientoCuenta" ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anuladoEn" TIMESTAMP(3),
ADD COLUMN     "anuladoPorId" INTEGER,
ADD COLUMN     "motivoAnulacion" TEXT;

-- AlterTable
ALTER TABLE "MovimientoProveedor" ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anuladoEn" TIMESTAMP(3),
ADD COLUMN     "anuladoPorId" INTEGER,
ADD COLUMN     "motivoAnulacion" TEXT;

-- AddForeignKey
ALTER TABLE "MovimientoCuenta" ADD CONSTRAINT "MovimientoCuenta_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoProveedor" ADD CONSTRAINT "MovimientoProveedor_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

