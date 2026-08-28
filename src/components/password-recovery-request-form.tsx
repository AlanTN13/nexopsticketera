"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  PasswordRecoveryRequestState,
  requestPasswordRecoveryAction,
} from "@/app/portal/recuperar-acceso/actions";
import { ActionStateForm, PendingSubmitButton } from "@/components/pending-form";

const initialState: PasswordRecoveryRequestState = {
  error: null,
  submitted: false,
};

export function PasswordRecoveryRequestForm() {
  const [state, action, pending] = useActionState(
    requestPasswordRecoveryAction,
    initialState,
  );

  if (state.submitted) {
    return (
      <div className="grid gap-4">
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          Si existe una cuenta con ese email, vas a recibir un enlace para elegir una nueva contraseña.
        </p>
        <p className="text-sm leading-6 text-slate-600">
          Revisá también correo no deseado. Por seguridad, no confirmamos si el email está registrado.
        </p>
        <Link className="text-sm font-semibold text-[#5b48c7] hover:text-[#4330a6]" href="/portal/login">
          Volver al ingreso
        </Link>
      </div>
    );
  }

  return (
    <ActionStateForm action={action} pending={pending} className="grid gap-4">
      <label className="grid gap-2 text-sm text-[#5a5d7f]" htmlFor="email">
        <span className="text-xs font-semibold text-slate-700">Email</span>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          required
          autoFocus
          className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          placeholder="tu@empresa.com"
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}

      <PendingSubmitButton
        idleLabel="Enviar enlace"
        pendingLabel="Enviando…"
        className="rounded-lg bg-[#5b48c7] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4936ad] disabled:cursor-not-allowed disabled:opacity-50"
      />

      <Link className="text-center text-sm font-semibold text-[#5b48c7] hover:text-[#4330a6]" href="/portal/login">
        Volver al ingreso
      </Link>
    </ActionStateForm>
  );
}
