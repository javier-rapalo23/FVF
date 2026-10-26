import { prisma } from "@/lib/prisma";

import { textoCantidad, textoMonto } from "./calculos";
import { saldosDeClientes } from "./saldo";
import type { Catalogo } from "./tipos";

/**
 * Todo lo que la caja necesita para trabajar sin más consultas: productos
 * activos con el stock de la sucursal y clientes activos con su saldo. Es la
 * misma respuesta que, en la Etapa 2, se guardará para vender sin conexión.
 */
export async function obtenerCatalogo(sucursal: {
  id: number;
  nombre: string;
}): Promise<Catalogo> {
  const [productos, clientes, saldos] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      select: {
        id: true,
        idInterno: true,
        codigoBarras: true,
        nombre: true,
        categoria: { select: { id: true, nombre: true } },
        unidadVenta: true,
        precioMinorista: true,
        precioMayorista: true,
        fechaVencimiento: true,
        stock: { where: { sucursalId: sucursal.id }, select: { cantidad: true } },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.cliente.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        fiadoHabilitado: true,
        limiteCredito: true,
      },
      orderBy: { nombre: "asc" },
    }),
    saldosDeClientes(prisma),
  ]);

  return {
    sucursal,
    generadoEn: new Date().toISOString(),
    productos: productos.map(({ stock, ...producto }) => ({
      ...producto,
      precioMinorista: textoMonto(producto.precioMinorista),
      precioMayorista: textoMonto(producto.precioMayorista),
      fechaVencimiento: producto.fechaVencimiento?.toISOString() ?? null,
      // Sin fila de stock todavía = 0 conocido.
      stock: textoCantidad(stock[0]?.cantidad ?? 0),
    })),
    clientes: clientes.map((cliente) => ({
      ...cliente,
      limiteCredito:
        cliente.limiteCredito === null ? null : textoMonto(cliente.limiteCredito),
      saldo: textoMonto(saldos.get(cliente.id) ?? 0),
    })),
  };
}
