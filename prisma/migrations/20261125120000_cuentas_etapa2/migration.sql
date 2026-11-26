-- CreateEnum
CREATE TYPE "MedioAbono" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA');

-- CreateEnum
CREATE TYPE "MedioPagoProveedor" AS ENUM ('EFECTIVO_CAJA', 'EFECTIVO_FUERA_CAJA', 'TRANSFERENCIA');

-- AlterTable
ALTER TABLE "MovimientoCuenta" ADD COLUMN     "cierreCajaId" INTEGER,
ADD COLUMN     "claveIdempotencia" TEXT,
ADD COLUMN     "medioPago" "MedioAbono",
ADD COLUMN     "nota" TEXT,
ADD COLUMN     "sucursalId" INTEGER,
ADD COLUMN     "usuarioId" INTEGER;

-- AlterTable
ALTER TABLE "MovimientoProveedor" ADD COLUMN     "cierreCajaId" INTEGER,
ADD COLUMN     "claveIdempotencia" TEXT,
ADD COLUMN     "medioPago" "MedioPagoProveedor",
ADD COLUMN     "nota" TEXT,
ADD COLUMN     "sucursalId" INTEGER,
ADD COLUMN     "usuarioId" INTEGER;

-- AlterTable
ALTER TABLE "CierreCaja" ADD COLUMN     "abonosEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pagosProveedorCaja" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoCuenta_claveIdempotencia_key" ON "MovimientoCuenta"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "MovimientoCuenta_sucursalId_cierreCajaId_idx" ON "MovimientoCuenta"("sucursalId", "cierreCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoProveedor_claveIdempotencia_key" ON "MovimientoProveedor"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "MovimientoProveedor_sucursalId_cierreCajaId_idx" ON "MovimientoProveedor"("sucursalId", "cierreCajaId");

-- AddForeignKey
ALTER TABLE "MovimientoCuenta" ADD CONSTRAINT "MovimientoCuenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuenta" ADD CONSTRAINT "MovimientoCuenta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuenta" ADD CONSTRAINT "MovimientoCuenta_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoProveedor" ADD CONSTRAINT "MovimientoProveedor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoProveedor" ADD CONSTRAINT "MovimientoProveedor_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoProveedor" ADD CONSTRAINT "MovimientoProveedor_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

