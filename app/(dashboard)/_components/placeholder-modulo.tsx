type Props = {
  titulo: string;
  descripcion: string;
};

/**
 * Contenido temporal de cada módulo. Existe solo para validar routing y
 * permisos por rol: la UI real se construye en las tareas siguientes.
 */
export function PlaceholderModulo({ titulo, descripcion }: Props) {
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        <p className="text-sm text-slate-500">{descripcion}</p>
      </header>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-600">
          Módulo pendiente de implementar
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Esta pantalla es un placeholder de la base del proyecto.
        </p>
      </div>
    </section>
  );
}
