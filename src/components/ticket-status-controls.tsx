"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateTicketStatusesAction } from "@/app/ticket-status-actions";
import { MAX_STATUS_UPDATE_TICKETS } from "@/lib/ticket-status-update";
import { ticketStatusOptions, type TicketStatus } from "@/lib/ticketing";

type Controls = {
  selected: Set<string>;
  pending: boolean;
  toggle: (id: string) => void;
  update: (ids: string[], status: TicketStatus) => void;
};
const StatusContext = createContext<Controls | null>(null);
const selectClass = "relative z-10 min-h-10 max-w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:opacity-50";

export function TicketStatusProvider(props: { editableIds: string[]; children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  // Route/filter changes remount selection; refreshing data preserves action feedback.
  return <TicketStatusSession key={`${pathname}?${params.toString()}`} {...props} />;
}

function TicketStatusSession({ editableIds, children }: { editableIds: string[]; children: ReactNode }) {
  const [selection, setSelection] = useState<string[]>([]);
  const [targetStatus, setTargetStatus] = useState<TicketStatus | "">("");
  const [notice, setNotice] = useState<{ error: string | null; message: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const router = useRouter();
  const visible = new Set(editableIds);
  const selected = new Set(selection.filter((id) => visible.has(id)));
  const allSelected = editableIds.length > 0 && selected.size === editableIds.length;

  function update(ids: string[], status: TicketStatus) {
    if (busy.current || !ids.length || ids.some((id) => !visible.has(id))) return;
    busy.current = true;
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await updateTicketStatusesAction(ids, status);
        setNotice(result);
        if (!result.error) {
          setSelection([]);
          setTargetStatus("");
        }
        router.refresh();
      } catch {
        setNotice({ error: "No pudimos confirmar el cambio. Actualizá el listado antes de reintentar.", message: null });
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  return <StatusContext.Provider value={{ selected, pending, update, toggle: (id) => {
    if (pending) return;
    setSelection((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous.filter((item) => visible.has(item)), id]);
  } }}>
    <div className="grid gap-3" aria-busy={pending}>
      {editableIds.length > 0 ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
        <label className="flex min-h-10 cursor-pointer items-center gap-2">
          <input type="checkbox" aria-label={`Seleccionar todos los tickets visibles editables (${editableIds.length})`} checked={allSelected} ref={(node) => { if (node) node.indeterminate = selected.size > 0 && !allSelected; }} disabled={pending || editableIds.length > MAX_STATUS_UPDATE_TICKETS} onChange={() => setSelection(allSelected ? [] : editableIds)} className="size-4 accent-violet-700" />
          Todos los visibles editables ({editableIds.length})
        </label>
        <span>{selected.size} seleccionado(s)</span>
        {selected.size > 0 ? <>
          <button type="button" disabled={pending} onClick={() => setSelection([])} className="min-h-10 px-2 text-xs underline">Limpiar selección</button>
          <label className="flex items-center gap-2 text-xs">Estado destino
            <select aria-label="Estado destino del lote" className={selectClass} value={targetStatus} disabled={pending} onChange={(event) => setTargetStatus(event.target.value as TicketStatus | "")}>
              <option value="">Elegir estado</option>
              {ticketStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" disabled={pending || !targetStatus || selected.size > MAX_STATUS_UPDATE_TICKETS} onClick={() => { if (targetStatus) update([...selected], targetStatus); }} className="min-h-10 rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "Guardando…" : `Aplicar a ${selected.size} ticket(s)`}
          </button>
        </> : null}
        {editableIds.length > MAX_STATUS_UPDATE_TICKETS ? <p className="basis-full text-xs">Máximo {MAX_STATUS_UPDATE_TICKETS} por cambio. Filtrá el listado o seleccioná menos tickets.</p> : null}
      </div> : null}
      {notice ? <p role={notice.error ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${notice.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice.error ?? notice.message}</p> : null}
      {children}
    </div>
  </StatusContext.Provider>;
}

export function TicketSelection({ id, code }: { id: string; code: string }) {
  const controls = useContext(StatusContext);
  if (!controls) return null;
  return <input type="checkbox" aria-label={`Seleccionar ${code}`} checked={controls.selected.has(id)} disabled={controls.pending} onChange={() => controls.toggle(id)} className="relative z-10 size-4 cursor-pointer accent-violet-700" />;
}

export function TicketInlineStatus({ id, code, status }: { id: string; code: string; status: TicketStatus }) {
  const controls = useContext(StatusContext);
  if (!controls) return null;
  return <select aria-label={`Estado de ${code}`} value={status} disabled={controls.pending} onChange={(event) => controls.update([id], event.target.value as TicketStatus)} className={selectClass}>
    {ticketStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
