-- Compras etapa 1. Agrega columnas obligatorias sin valor por defecto a
-- "Compra" y "DetalleCompra": las tablas tienen que estar vacías (hasta ahora
-- no había forma de registrar compras desde la app).

-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('CONTADO', 'CREDITO');

-- AlterEnum
ALTER TYPE "TipoMovimientoProveedor" ADD VALUE 'ANULACION';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "costoActual" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "anulada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "claveIdempotencia" TEXT NOT NULL,
ADD COLUMN     "condicionPago" "CondicionPago" NOT NULL,
ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notas" TEXT,
ADD COLUMN     "numeroFactura" TEXT,
ALTER COLUMN "fecha" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DetalleCompra" ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL;

-- CreateTable
CREATE TABLE "AnulacionCompra" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnulacionCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnulacionCompra_compraId_key" ON "AnulacionCompra"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_claveIdempotencia_key" ON "Compra"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "Compra_sucursalId_fecha_idx" ON "Compra"("sucursalId", "fecha");

-- CreateIndex
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");

-- CreateIndex
CREATE INDEX "MovimientoProveedor_proveedorId_idx" ON "MovimientoProveedor"("proveedorId");

-- AddForeignKey
ALTER TABLE "AnulacionCompra" ADD CONSTRAINT "AnulacionCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnulacionCompra" ADD CONSTRAINT "AnulacionCompra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

