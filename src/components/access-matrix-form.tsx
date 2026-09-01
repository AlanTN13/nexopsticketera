"use client";

import { useMemo, useState } from "react";

import {
  updateInternalCompanyAccessAction,
  updateUserModulePermissionsAction,
} from "@/app/actions";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { canManageAccessControl } from "@/lib/authorization";
import {
  Company,
  MODULE_ACCESS_LEVELS,
  ModuleAccessLevel,
  PORTAL_MODULES,
  PortalModuleKey,
  UserProfile,
} from "@/lib/ticketing";

const moduleCopy: Record<PortalModuleKey, { label: string; description: string }> = {
  support: { label: "Soporte", description: "Tickets, comentarios, adjuntos y seguimiento." },
  metrics: { label: "Métricas", description: "Dashboard y actualización de reportería." },
  radar: { label: "Radar", description: "Lectura y operación del workspace editorial." },
  content: { label: "Contenido", description: "Base preparada; la función se implementa después de este gate." },
};

const levelLabels: Record<ModuleAccessLevel, string> = {
  none: "Sin acceso",
  view: "Ver",
  operate: "Operar",
  admin: "Administrar",
};

function currentLevels(user: UserProfile, companyId: string) {
  return Object.fromEntries(
    PORTAL_MODULES.map((module) => [
      module,
      user.modulePermissions?.find(
        (permission) => permission.companyId === companyId && permission.module === module,
      )?.level ?? "none",
    ]),
  ) as Record<PortalModuleKey, ModuleAccessLevel>;
}

export function AccessMatrixForm({
  actor,
  user,
  company,
  internalAssignment = false,
  returnPath,
}: {
  actor: UserProfile;
  user: UserProfile;
  company: Company;
  internalAssignment?: boolean;
  returnPath: string;
}) {
  const [assigned, setAssigned] = useState(
    !internalAssignment || Boolean(user.assignedCompanyIds?.includes(company.id)),
  );
  const [levels, setLevels] = useState(() => currentLevels(user, company.id));
  const canManage = canManageAccessControl(actor);
  const summary = useMemo(
    () =>
      PORTAL_MODULES.map((module) => {
        const requested = levels[module];
        if (!assigned || requested === "none") {
          return `${moduleCopy[module].label}: sin acceso`;
        }
        if (!company.modules[module].enabled) {
          return `${moduleCopy[module].label}: ${levelLabels[requested].toLowerCase()} asignado, pero el módulo está deshabilitado para ${company.name}`;
        }
        return `${moduleCopy[module].label}: puede ${levelLabels[requested].toLowerCase()}`;
      }),
    [assigned, company, levels],
  );

  if (!canManage) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        Sólo un administrador de plataforma puede cambiar empresas y permisos. El nivel “administrar” se limita a la función del módulo.
      </p>
    );
  }

  return (
    <PendingForm
      action={internalAssignment ? updateInternalCompanyAccessAction : updateUserModulePermissionsAction}
      className="grid gap-4"
    >
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="companyId" value={company.id} />
      <input type="hidden" name="returnPath" value={returnPath} />

      {internalAssignment ? (
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            type="checkbox"
            name="companyAssigned"
            checked={assigned}
            onChange={(event) => setAssigned(event.target.checked)}
            className="mt-1 size-4 accent-violet-700"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-950">Puede atender {company.name}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">
              Sin esta asignación, ningún permiso de módulo es efectivo.
            </span>
          </span>
        </label>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {PORTAL_MODULES.map((module) => (
          <label key={module} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-950">{moduleCopy[module].label}</span>
              <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${company.modules[module].enabled ? "text-emerald-700" : "text-amber-700"}`}>
                {company.modules[module].enabled ? "Empresa habilitada" : "Empresa deshabilitada"}
              </span>
            </span>
            <span className="text-xs leading-5 text-slate-600">{moduleCopy[module].description}</span>
            <select
              name={`permission-${module}`}
              value={levels[module]}
              disabled={!assigned}
              onChange={(event) =>
                setLevels((current) => ({
                  ...current,
                  [module]: event.target.value as ModuleAccessLevel,
                }))
              }
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {MODULE_ACCESS_LEVELS.map((level) => (
                <option key={level} value={level}>{levelLabels[level]}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-800">Acceso efectivo antes de guardar</p>
        <ul className="mt-2 grid gap-1 text-sm leading-5 text-slate-700">
          {summary.map((item) => <li key={item}>{item}.</li>)}
        </ul>
      </div>

      <label className="grid gap-2 text-sm text-slate-700">
        <span className="text-xs font-semibold">Motivo del cambio (opcional)</span>
        <input
          name="reason"
          maxLength={500}
          placeholder="Ej.: incorporación al equipo de la cuenta"
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
        />
      </label>

      <PendingSubmitButton
        idleLabel="Guardar acceso"
        pendingLabel="Guardando…"
        className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:opacity-50"
      />
    </PendingForm>
  );
}
