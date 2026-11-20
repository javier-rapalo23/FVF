-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "correo" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "rtn" TEXT;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "observaciones" TEXT;
