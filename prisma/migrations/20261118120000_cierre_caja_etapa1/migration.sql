-- Etapa 1 de cierre de caja: período encadenado, desglose del efectivo
-- esperado, fondo, detalle de conteo y revisión del administrador.
--
-- Las columnas obligatorias se agregan con un valor de relleno y después se
-- les quita el default, así la migración funciona aunque ya hubiera cierres
-- cargados a mano (el módulo no existía, así que lo normal es que esté vacía).

-- AlterTable
ALTER TABLE "CierreCaja"
ADD COLUMN     "desde" TIMESTAMP(3),
ADD COLUMN     "cierreAnteriorId" INTEGER,
ADD COLUMN     "claveIdempotencia" TEXT,
ADD COLUMN     "fondoInicial" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ventasEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "devolucionesEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ventasTransferencia" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ventasTarjeta" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ventasFiado" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cantidadVentas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fondoSiguiente" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "detalleConteo" JSONB,
ADD COLUMN     "notas" TEXT,
ADD COLUMN     "revisadoPorId" INTEGER,
ADD COLUMN     "revisadoEn" TIMESTAMP(3),
ADD COLUMN     "notaRevision" TEXT;

-- Relleno de filas previas: período de cero y clave propia.
UPDATE "CierreCaja" SET "desde" = "fecha", "claveIdempotencia" = 'migrado-' || "id";

ALTER TABLE "CierreCaja"
ALTER COLUMN "desde" SET NOT NULL,
ALTER COLUMN "claveIdempotencia" SET NOT NULL,
ALTER COLUMN "fondoInicial" DROP DEFAULT,
ALTER COLUMN "ventasEfectivo" DROP DEFAULT,
ALTER COLUMN "devolucionesEfectivo" DROP DEFAULT,
ALTER COLUMN "ventasTransferencia" DROP DEFAULT,
ALTER COLUMN "ventasTarjeta" DROP DEFAULT,
ALTER COLUMN "ventasFiado" DROP DEFAULT,
ALTER COLUMN "cantidadVentas" DROP DEFAULT,
ALTER COLUMN "fondoSiguiente" DROP DEFAULT;

-- AlterTable: cada venta y cada anulación queda asignada al cierre que la
-- incluyó. Las existentes quedan sin cierre; el primer cierre de cada
-- sucursal solo toma las del día en que se registra.
ALTER TABLE "Venta" ADD COLUMN     "cierreCajaId" INTEGER;
ALTER TABLE "AnulacionVenta" ADD COLUMN     "cierreCajaId" INTEGER;

-- CreateIndex
CREATE INDEX "Venta_sucursalId_cierreCajaId_idx" ON "Venta"("sucursalId", "cierreCajaId");

-- CreateIndex
CREATE INDEX "AnulacionVenta_cierreCajaId_idx" ON "AnulacionVenta"("cierreCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "CierreCaja_cierreAnteriorId_key" ON "CierreCaja"("cierreAnteriorId");

-- CreateIndex
CREATE UNIQUE INDEX "CierreCaja_claveIdempotencia_key" ON "CierreCaja"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "CierreCaja_sucursalId_fecha_idx" ON "CierreCaja"("sucursalId", "fecha");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnulacionVenta" ADD CONSTRAINT "AnulacionVenta_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_cierreAnteriorId_fkey" FOREIGN KEY ("cierreAnteriorId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
