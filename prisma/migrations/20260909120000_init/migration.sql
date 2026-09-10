-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRADOR', 'EMPLEADO_CAJA');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('MINORISTA', 'MAYORISTA');

-- CreateEnum
CREATE TYPE "UnidadVenta" AS ENUM ('PESO', 'UNIDAD', 'PAQUETE');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('LOCAL', 'PEDIDO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'FIADO');

-- CreateEnum
CREATE TYPE "TipoMovimientoCuenta" AS ENUM ('CARGO', 'ABONO');

-- CreateEnum
CREATE TYPE "TipoMovimientoProveedor" AS ENUM ('CARGO', 'PAGO');

-- CreateEnum
CREATE TYPE "CategoriaGasto" AS ENUM ('OPERATIVO', 'MERCADERIA', 'ADMINISTRATIVO');

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "idInterno" INTEGER NOT NULL,
    "codigoBarras" TEXT,
    "nombre" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "proveedorId" INTEGER,
    "unidadVenta" "UnidadVenta" NOT NULL,
    "precioMinorista" DECIMAL(10,2) NOT NULL,
    "precioMayorista" DECIMAL(10,2) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "sucursalId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'MINORISTA',
    "limiteCredito" DECIMAL(10,2),
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" INTEGER,
    "usuarioId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "canal" "Canal" NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "anulada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleCompra" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "costoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DetalleCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCuenta" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "ventaId" INTEGER,
    "tipo" "TipoMovimientoCuenta" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoProveedor" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "compraId" INTEGER,
    "tipo" "TipoMovimientoProveedor" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreCaja" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "totalSistema" DECIMAL(10,2) NOT NULL,
    "totalContado" DECIMAL(10,2) NOT NULL,
    "diferencia" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CierreCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" "CategoriaGasto" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "sucursalId" INTEGER,
    "descripcion" TEXT,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_idInterno_key" ON "Producto"("idInterno");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_productoId_sucursalId_key" ON "Stock"("productoId", "sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuenta" ADD CONSTRAINT "MovimientoCuenta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuenta" ADD CONSTRAINT "MovimientoCuenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoProveedor" ADD CONSTRAINT "MovimientoProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoProveedor" ADD CONSTRAINT "MovimientoProveedor_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

