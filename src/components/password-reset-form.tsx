"use client";

import { useActionState } from "react";

import {
  PasswordResetState,
  resetPasswordAction,
} from "@/app/portal/restablecer-acceso/actions";
import { ActionStateForm, PendingSubmitButton } from "@/components/pending-form";
import { MINIMUM_PASSWORD_LENGTH } from "@/lib/account-activation";

const initialState: PasswordResetState = { error: null };

const inputClassName =
  "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-100";

export function PasswordResetForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <ActionStateForm action={action} pending={pending} className="grid gap-4">
      <label className="grid gap-2 text-sm text-[#5a5d7f]" htmlFor="password">
        <span className="text-xs font-semibold text-slate-700">Nueva contraseña</span>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MINIMUM_PASSWORD_LENGTH}
          required
          autoFocus
          className={inputClassName}
          placeholder={`Mínimo ${MINIMUM_PASSWORD_LENGTH} caracteres`}
        />
      </label>

      <label className="grid gap-2 text-sm text-[#5a5d7f]" htmlFor="confirmation">
        <span className="text-xs font-semibold text-slate-700">Repetir contraseña</span>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={MINIMUM_PASSWORD_LENGTH}
          required
          className={inputClassName}
          placeholder="Repetí la contraseña"
        />
      </label>

      <p className="text-xs leading-5 text-slate-600">
        Usá al menos {MINIMUM_PASSWORD_LENGTH} caracteres y evitá reutilizar una contraseña de otro servicio.
      </p>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}

      <PendingSubmitButton
        idleLabel="Guardar contraseña"
        pendingLabel="Guardando…"
        className="rounded-lg bg-[#5b48c7] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4936ad] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </ActionStateForm>
  );
}
