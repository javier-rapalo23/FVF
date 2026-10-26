-- AlterEnum
ALTER TYPE "TipoMovimientoCuenta" ADD VALUE 'ANULACION';

-- AlterTable
-- `claveIdempotencia` es obligatoria y sin valor por defecto: la migración
-- asume que la tabla "Venta" está vacía (hasta este módulo no se registraban
-- ventas). Si tuviera filas, este ALTER falla y hay que resolverlo a mano.
ALTER TABLE "Venta" ADD COLUMN     "claveIdempotencia" TEXT NOT NULL,
ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notas" TEXT;

-- CreateTable
CREATE TABLE "AnulacionVenta" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "reingresaStock" BOOLEAN NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnulacionVenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnulacionVenta_ventaId_key" ON "AnulacionVenta"("ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_claveIdempotencia_key" ON "Venta"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "Venta_sucursalId_fecha_idx" ON "Venta"("sucursalId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoCuenta_clienteId_idx" ON "MovimientoCuenta"("clienteId");

-- AddForeignKey
ALTER TABLE "AnulacionVenta" ADD CONSTRAINT "AnulacionVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnulacionVenta" ADD CONSTRAINT "AnulacionVenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
