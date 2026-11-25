-- Gastos, Etapa 2 (Especificacion_Gastos.md, sección 6.1): gastos fijos.
--
-- Solo agrega una tabla y una columna opcional: no toca datos existentes.

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "gastoFijoId" INTEGER;

-- CreateTable
CREATE TABLE "GastoFijo" (
    "id" SERIAL NOT NULL,
    "conceptoId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "montoEstimado" DECIMAL(10,2) NOT NULL,
    "diaDelMes" INTEGER NOT NULL,
    "medioPago" "MedioPagoGasto" NOT NULL,
    "sucursalId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GastoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gasto_gastoFijoId_idx" ON "Gasto"("gastoFijoId");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_gastoFijoId_fkey" FOREIGN KEY ("gastoFijoId") REFERENCES "GastoFijo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoFijo" ADD CONSTRAINT "GastoFijo_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoFijo" ADD CONSTRAINT "GastoFijo_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
