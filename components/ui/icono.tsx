import type { SVGProps } from "react";

/**
 * Set de iconos propio.
 *
 * Se dibujan a mano en vez de sumar una librería: son quince glifos, la
 * especificación pide justificar cada dependencia nueva, y así el grosor de
 * trazo queda idéntico en todos (las librerías genéricas mezclan pesos y se
 * nota). Trazo 1.75 sobre grilla de 24 para que lean firmes a 18-20px.
 */
const GLIFOS = {
  caja: (
    <>
      <path d="M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4L5.5 8Z" />
      <path d="M9 8.5V6a3 3 0 0 1 6 0v2.5" />
    </>
  ),
  cierres: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5.5 8.5v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-10" />
      <path d="M10 12.5h4" />
    </>
  ),
  productos: (
    <>
      <path d="M12 3.2 20 7.5v9L12 20.8 4 16.5v-9L12 3.2Z" />
      <path d="m4 7.5 8 4.3 8-4.3" />
      <path d="M12 11.8v9" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9.5" cy="8.5" r="3" />
      <path d="M3.5 19.5c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.6" />
      <path d="M18 14.9c1.6.7 2.5 2.1 2.5 4.6" />
    </>
  ),
  proveedores: (
    <>
      <path d="M3.5 6.5h10v10h-10z" />
      <path d="M13.5 9.5h3.6l3.4 3.4v3.6h-7z" />
      <circle cx="7.5" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </>
  ),
  compras: (
    <>
      <path d="M12 3v9.5" />
      <path d="m8.3 10.2 3.7 3.8 3.7-3.8" />
      <path d="M4 16v2.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V16" />
    </>
  ),
  gastos: (
    <>
      <path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5z" />
      <path d="M9.5 8.5h5" />
      <path d="M9.5 12.5h5" />
    </>
  ),
  reportes: (
    <>
      <path d="M4 20.5h16.5" />
      <path d="M7.5 20.5v-6" />
      <path d="M12 20.5V6.5" />
      <path d="M16.5 20.5v-9" />
    </>
  ),
  usuarios: (
    <>
      <path d="M12 3.2 19 6v5.8c0 4-2.9 7.2-7 8.4-4.1-1.2-7-4.4-7-8.4V6l7-2.8Z" />
      <circle cx="12" cy="10.2" r="2" />
      <path d="M8.7 16.2c.5-1.7 1.8-2.6 3.3-2.6s2.8.9 3.3 2.6" />
    </>
  ),
  tienda: (
    <>
      <path d="M4 9.5h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-10Z" />
      <path d="M3.2 9.5 5 4.2h14l1.8 5.3" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),
  buscar: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  mas: (
    <>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </>
  ),
  menos: <path d="M5.5 12h13" />,
  basura: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7v12.3a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7" />
    </>
  ),
  salir: (
    <>
      <path d="M14.5 4.5H18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3.5" />
      <path d="M10 8.2 14 12l-4 3.8" />
      <path d="M14 12H4.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alerta: (
    <>
      <path d="M12 4.2 21 19.5H3L12 4.2Z" />
      <path d="M12 10v4" />
      <path d="M12 16.8h.01" />
    </>
  ),
  chevron: <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
} as const;

export type NombreIcono = keyof typeof GLIFOS;

type Props = SVGProps<SVGSVGElement> & {
  nombre: NombreIcono;
  /** Lado del icono en px. El trazo se mantiene óptico entre 16 y 24. */
  tamano?: number;
};

export function Icono({ nombre, tamano = 18, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {GLIFOS[nombre]}
    </svg>
  );
}
