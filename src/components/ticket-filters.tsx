import Link from "next/link";

export type TicketFilterDefinition = {
  name: string;
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
};

export function TicketFilters({
  basePath,
  query,
  filters,
}: {
  basePath: string;
  query?: string;
  filters: TicketFilterDefinition[];
}) {
  const activeFilters = [
    ...(query ? [{ name: "query", label: `Búsqueda: ${query}`, value: query }] : []),
    ...filters.flatMap((filter) => {
      if (!filter.value || filter.value === "all") return [];
      const option = filter.options.find((item) => item.value === filter.value);
      return [{ name: filter.name, label: option?.label ?? filter.value, value: filter.value }];
    }),
  ];

  const currentParams = new URLSearchParams();
  if (query) currentParams.set("query", query);
  filters.forEach((filter) => {
    if (filter.value && filter.value !== "all") currentParams.set(filter.name, filter.value);
  });

  return (
    <div className="grid gap-2.5">
      <form className="flex flex-wrap items-center gap-2">
        <label className="min-w-[220px] flex-1" htmlFor="ticket-search">
          <span className="sr-only">Buscar por código o título</span>
          <input
            id="ticket-search"
            name="query"
            defaultValue={query ?? ""}
            placeholder="Buscar por código o título"
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        {filters.map((filter) => (
          <label key={filter.name} className="min-w-[145px] flex-1 sm:max-w-[210px]">
            <span className="sr-only">{filter.label}</span>
            <select
              name={filter.name}
              defaultValue={filter.value ?? "all"}
              className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            >
              <option value="all">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}

        <button type="submit" className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
          Filtrar
        </button>
      </form>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          <span className="text-xs font-medium text-slate-600">Filtros activos:</span>
          {activeFilters.map((active) => {
            const nextParams = new URLSearchParams(currentParams);
            nextParams.delete(active.name);
            const queryString = nextParams.toString();
            return (
              <Link
                key={`${active.name}-${active.value}`}
                href={queryString ? `${basePath}?${queryString}` : basePath}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-900 hover:border-violet-400"
                aria-label={`Quitar filtro ${active.label}`}
              >
                {active.label} <span aria-hidden>×</span>
              </Link>
            );
          })}
          <Link href={basePath} className="text-xs font-semibold text-slate-700 underline-offset-4 hover:underline">
            Limpiar todos
          </Link>
        </div>
      ) : null}
    </div>
  );
}
