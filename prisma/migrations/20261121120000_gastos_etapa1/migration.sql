-- Gastos, Etapa 1 (Especificacion_Gastos.md).
--
-- `Gasto` pierde `categoria` y gana columnas obligatorias sin valor por
-- defecto. Ninguna pantalla escribía gastos hasta ahora, así que la tabla
-- debería estar vacía; si no lo está, se frena acá con un mensaje claro en vez
-- de fallar a mitad de camino.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Gasto") THEN
    RAISE EXCEPTION 'La tabla "Gasto" tiene filas: revisarlas antes de migrar (ver Especificacion_Gastos.md, sección 2).';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "MedioPagoGasto" AS ENUM ('EFECTIVO_CAJA', 'EFECTIVO_FUERA_CAJA', 'TRANSFERENCIA', 'TARJETA');

-- AlterTable
ALTER TABLE "CierreCaja" ADD COLUMN     "gastosCaja" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Gasto" DROP COLUMN "categoria",
ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cierreCajaId" INTEGER,
ADD COLUMN     "claveIdempotencia" TEXT NOT NULL,
ADD COLUMN     "conceptoId" INTEGER NOT NULL,
ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "medioPago" "MedioPagoGasto" NOT NULL,
ADD COLUMN     "numeroComprobante" TEXT,
ALTER COLUMN "fecha" DROP DEFAULT,
ALTER COLUMN "descripcion" SET NOT NULL;

-- CreateTable
CREATE TABLE "ConceptoGasto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaGasto" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConceptoGasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnulacionGasto" (
    "id" SERIAL NOT NULL,
    "gastoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnulacionGasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoGasto_nombre_key" ON "ConceptoGasto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "AnulacionGasto_gastoId_key" ON "AnulacionGasto"("gastoId");

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_claveIdempotencia_key" ON "Gasto"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE INDEX "Gasto_sucursalId_cierreCajaId_idx" ON "Gasto"("sucursalId", "cierreCajaId");

-- CreateIndex
CREATE INDEX "Gasto_conceptoId_idx" ON "Gasto"("conceptoId");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cierreCajaId_fkey" FOREIGN KEY ("cierreCajaId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnulacionGasto" ADD CONSTRAINT "AnulacionGasto_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnulacionGasto" ADD CONSTRAINT "AnulacionGasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conceptos iniciales: viajan en la migración para que producción los tenga
-- sin depender del seed.
INSERT INTO "ConceptoGasto" ("nombre", "categoria") VALUES
  ('Alquiler', 'OPERATIVO'),
  ('Energía eléctrica', 'OPERATIVO'),
  ('Agua', 'OPERATIVO'),
  ('Internet y teléfono', 'OPERATIVO'),
  ('Salarios y jornales', 'OPERATIVO'),
  ('Limpieza', 'OPERATIVO'),
  ('Mantenimiento y reparaciones', 'OPERATIVO'),
  ('Combustible', 'OPERATIVO'),
  ('Fletes y transporte', 'MERCADERIA'),
  ('Bolsas y empaques', 'MERCADERIA'),
  ('Hielo', 'MERCADERIA'),
  ('Carga y descarga', 'MERCADERIA'),
  ('Papelería', 'ADMINISTRATIVO'),
  ('Contador y asesoría', 'ADMINISTRATIVO'),
  ('Impuestos y permisos municipales', 'ADMINISTRATIVO'),
  ('Comisiones bancarias', 'ADMINISTRATIVO'),
  ('Otros gastos', 'ADMINISTRATIVO');
