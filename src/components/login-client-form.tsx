"use client";

import { useActionState } from "react";

import { LoginClientState, loginClientAction } from "@/app/actions";

const initialState: LoginClientState = {
  error: null,
};

export function LoginClientForm() {
  const [state, action, pending] = useActionState(loginClientAction, initialState);

  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm text-[#5f6385]" htmlFor="email">
        <span className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b48c7]">
          Email
        </span>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-[22px] border border-[rgba(91,72,199,0.18)] bg-white/82 px-4 py-3 text-sm text-[#1b1638] outline-none transition placeholder:text-[#8c90b2] focus:border-[#7c5bff] focus:bg-white"
          placeholder="tu@empresa.com"
        />
      </label>

      <label className="grid gap-2 text-sm text-[#5f6385]" htmlFor="password">
        <span className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b48c7]">
          Contraseña
        </span>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-[22px] border border-[rgba(91,72,199,0.18)] bg-white/82 px-4 py-3 text-sm text-[#1b1638] outline-none transition placeholder:text-[#8c90b2] focus:border-[#7c5bff] focus:bg-white"
          placeholder="Ingresá tu contraseña"
        />
      </label>

      {state.error ? (
        <div className="rounded-[18px] border border-rose-300/30 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[22px] bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] px-5 py-3 text-sm font-semibold text-[#120d31] transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
