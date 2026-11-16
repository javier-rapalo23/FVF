import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { RegistroCatalogo, VentaPendiente } from "./tipos";

/*
 * Base local de la caja (IndexedDB). Se usa `idb` en lugar de la API nativa
 * por su verbosidad: eventos de request/transaction en vez de promesas.
 *
 * El carrito en curso sigue en localStorage (ver caja/_components/carrito.ts):
 * es chico, síncrono y no necesita sobrevivir a nada más que una recarga.
 */

interface EsquemaCaja extends DBSchema {
  catalogo: { key: string; value: RegistroCatalogo };
  ventasPendientes: {
    key: string;
    value: VentaPendiente;
    indexes: { creadoEn: number };
  };
}

export type BaseCaja = IDBPDatabase<EsquemaCaja>;

const NOMBRE = "ferrera-caja";
const VERSION = 1;

let conexion: Promise<BaseCaja> | null = null;

export function abrirBase(): Promise<BaseCaja> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Este navegador no tiene IndexedDB."));
  }

  conexion ??= openDB<EsquemaCaja>(NOMBRE, VERSION, {
    upgrade(db) {
      db.createObjectStore("catalogo", { keyPath: "clave" });
      const ventas = db.createObjectStore("ventasPendientes", { keyPath: "claveIdempotencia" });
      ventas.createIndex("creadoEn", "creadoEn");
    },
    // Otra pestaña con una versión nueva de la app pide actualizar el esquema.
    blocking() {
      void conexion?.then((db) => db.close());
      conexion = null;
    },
  }).catch((error: unknown) => {
    // Que el próximo intento vuelva a probar (ej. almacenamiento liberado).
    conexion = null;
    throw error;
  });

  return conexion;
}
