-- Etapa 2 de compras e inventario: ajustes de stock (conteo y merma), stock
-- mínimo por producto e índices para el historial por producto (kardex).
-- Solo agrega: no toca datos existentes.

-- CreateEnum
CREATE TYPE "TipoAjusteStock" AS ENUM ('CONTEO', 'MERMA');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "stockMinimo" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "AjusteStock" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoAjusteStock" NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "stockAnterior" DECIMAL(10,3) NOT NULL,
    "stockResultante" DECIMAL(10,3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjusteStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AjusteStock_productoId_sucursalId_fecha_idx" ON "AjusteStock"("productoId", "sucursalId", "fecha");

-- CreateIndex
CREATE INDEX "DetalleVenta_productoId_idx" ON "DetalleVenta"("productoId");

-- CreateIndex
CREATE INDEX "DetalleCompra_productoId_idx" ON "DetalleCompra"("productoId");

-- AddForeignKey
ALTER TABLE "AjusteStock" ADD CONSTRAINT "AjusteStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteStock" ADD CONSTRAINT "AjusteStock_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteStock" ADD CONSTRAINT "AjusteStock_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

