import Link from "next/link";

export type TicketFilterDefinition = {
  name: string;
  label: string;
  value?: string | string[];
  options: Array<{ value: string; label: string }>;
};

export function getSelectedFilterValues(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(values.filter((item) => item && item !== "all")));
}

export function TicketFilters({
  basePath,
  query,
  filters,
  multiple = false,
  defaultedFilters = [],
}: {
  basePath: string;
  query?: string;
  filters: TicketFilterDefinition[];
  multiple?: boolean;
  defaultedFilters?: string[];
}) {
  const activeFilters = [
    ...(query ? [{ name: "query", label: `Búsqueda: ${query}`, value: query }] : []),
    ...filters.flatMap((filter) => {
      return getSelectedFilterValues(filter.value).map((value) => {
        const option = filter.options.find((item) => item.value === value);
        return { name: filter.name, label: option?.label ?? value, value };
      });
    }),
  ];

  const currentParams = new URLSearchParams();
  if (query) currentParams.set("query", query);
  filters.forEach((filter) => {
    const selectedValues = getSelectedFilterValues(filter.value);
    selectedValues.forEach((value) => currentParams.append(filter.name, value));
    if (!selectedValues.length && filter.value === "all") {
      currentParams.append(filter.name, "all");
    }
  });
  const clearAllParams = new URLSearchParams();
  defaultedFilters.forEach((name) => clearAllParams.set(name, "all"));
  const clearAllHref = clearAllParams.size ? `${basePath}?${clearAllParams.toString()}` : basePath;

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

        {filters.map((filter) => {
          const selectedValues = getSelectedFilterValues(filter.value);
          const selectedLabels = selectedValues
            .map((value) => filter.options.find((option) => option.value === value)?.label ?? value)
            .join(", ");

          if (!multiple) {
            return (
              <label key={filter.name} className="min-w-[145px] flex-1 sm:max-w-[210px]">
                <span className="sr-only">{filter.label}</span>
                <select
                  name={filter.name}
                  defaultValue={selectedValues[0] ?? "all"}
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="all">{filter.label}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <details key={filter.name} className="group relative min-w-[145px] flex-1 max-sm:basis-full sm:max-w-[210px]">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus-visible:border-violet-600 focus-visible:ring-2 focus-visible:ring-violet-100 [&::-webkit-details-marker]:hidden">
                <span className="truncate">{selectedValues.length ? selectedLabels : filter.label}</span>
                <span aria-hidden className="text-xs text-slate-500 transition group-open:rotate-180">⌄</span>
              </summary>
              <fieldset className="absolute left-0 z-20 mt-1 grid max-h-72 w-full min-w-[220px] gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl max-sm:min-w-0">
                <legend className="sr-only">{filter.label}</legend>
                <p className="px-2 py-1 text-xs font-semibold text-slate-500">
                  {selectedValues.length ? `${selectedValues.length} seleccionada(s)` : filter.label}
                </p>
                {filter.options.map((option) => (
                  <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-slate-800 hover:bg-violet-50">
                    <input
                      type="checkbox"
                      name={filter.name}
                      value={option.value}
                      defaultChecked={selectedValues.includes(option.value)}
                      className="size-4 accent-violet-700"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                {selectedValues.length ? (
                  <Link
                    href={(() => {
                      const params = new URLSearchParams(currentParams);
                      params.set(filter.name, "all");
                      const queryString = params.toString();
                      return queryString ? `${basePath}?${queryString}` : basePath;
                    })()}
                    className="mt-1 rounded-lg px-2 py-2 text-center text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Limpiar filtro
                  </Link>
                ) : null}
              </fieldset>
            </details>
          );
        })}

        <button type="submit" className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
          Filtrar
        </button>
      </form>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          <span className="text-xs font-medium text-slate-600">Filtros activos:</span>
          {activeFilters.map((active) => {
            const nextParams = new URLSearchParams(currentParams);
            if (active.name === "query") {
              nextParams.delete(active.name);
            } else {
              const remainingValues = nextParams
                .getAll(active.name)
                .filter((value) => value !== active.value);
              nextParams.delete(active.name);
              if (remainingValues.length) {
                remainingValues.forEach((value) => nextParams.append(active.name, value));
              } else {
                nextParams.set(active.name, "all");
              }
            }
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
          <Link href={clearAllHref} className="text-xs font-semibold text-slate-700 underline-offset-4 hover:underline">
            Limpiar todos
          </Link>
        </div>
      ) : null}
    </div>
  );
}
