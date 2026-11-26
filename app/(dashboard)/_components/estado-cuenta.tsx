import Link from "next/link";

import { Etiqueta } from "@/components/ui/etiqueta";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import type { FilaEstadoCuenta } from "@/lib/cuentas/tipos";
import { fecha, formatoMoneda } from "@/lib/formato";

/** Tope de filas en pantalla. El saldo acumulado se calcula igual sobre todas. */
const FILAS_VISIBLES = 100;

/**
 * Estado de cuenta de un cliente (fiado) o de un proveedor: movimientos del
 * más reciente al más viejo, con el saldo que dejó cada uno.
 */
export function EstadoCuenta({
  filas,
  cuenta,
}: {
  filas: readonly FilaEstadoCuenta[];
  cuenta: "cliente" | "proveedor";
}) {
  const esCliente = cuenta === "cliente";

  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-borde px-4 py-6 text-center text-[13px] text-tinta-suave">
        {esCliente
          ? "Todavía no hay ventas al fiado ni abonos."
          : "Todavía no hay compras a crédito ni pagos."}
      </p>
    );
  }

  const visibles = filas.slice(-FILAS_VISIBLES).reverse();

  return (
    <>
      <Tabla
        columnas={[
          { label: "Fecha" },
          { label: "Movimiento" },
          { label: "Detalle", ocultaMovil: true },
          { label: "Importe", derecha: true },
          { label: "Saldo", derecha: true },
        ]}
      >
        {visibles.map((f) => (
          <Fila key={f.id}>
            <Celda className="cifras whitespace-nowrap text-tinta-media">{fecha(f.fecha)}</Celda>
            <Celda>
              <Movimiento fila={f} esCliente={esCliente} />
            </Celda>
            <Celda ocultaMovil className="text-tinta-media">
              {[f.medio, f.usuario, f.nota].filter(Boolean).join(" · ") || "—"}
            </Celda>
            <Celda
              derecha
              className={`cifras whitespace-nowrap ${f.importe.startsWith("-") ? "text-exito-tinta" : ""}`}
            >
              {f.importe.startsWith("-") ? "− " : "+ "}
              {formatoMoneda(f.importe.replace("-", ""))}
            </Celda>
            <Celda derecha className="cifras whitespace-nowrap font-medium">
              {formatoMoneda(f.saldo)}
            </Celda>
          </Fila>
        ))}
      </Tabla>
      {filas.length > visibles.length ? (
        <p className="mt-2 text-[12px] text-tinta-suave">
          Se muestran los últimos {visibles.length} de {filas.length} movimientos.
        </p>
      ) : null}
    </>
  );
}

function Movimiento({ fila, esCliente }: { fila: FilaEstadoCuenta; esCliente: boolean }) {
  const origen =
    fila.origenId === null ? null : (
      <Link
        href={esCliente ? `/caja/ventas/${fila.origenId}` : `/compras/${fila.origenId}`}
        className="cifras underline-offset-2 hover:underline"
      >
        {esCliente ? "Venta" : "Compra"} N° {fila.origenId}
      </Link>
    );

  switch (fila.tipo) {
    case "CARGO":
      return origen ?? <>{esCliente ? "Venta al fiado" : "Compra a crédito"}</>;
    case "ANULACION":
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <Etiqueta tono="peligro">Anulación</Etiqueta>
          {origen}
        </span>
      );
    case "ABONO":
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <Etiqueta tono="exito">Abono</Etiqueta>
          <Link
            href={`/caja/abonos/${fila.id}`}
            className="cifras text-[12px] text-tinta-media underline-offset-2 hover:underline"
          >
            Comprobante
          </Link>
        </span>
      );
    case "PAGO":
      return <Etiqueta tono="exito">Pago</Etiqueta>;
  }
}
