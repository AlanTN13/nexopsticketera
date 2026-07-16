"use client";

import { useActionState, useState } from "react";

import { createUserAction, CreateUserState } from "@/app/actions";
import {
  USER_ROLES,
  UserProfile,
  roleLabels,
} from "@/lib/ticketing";
import { REQUIRED_USER_TITLE_MESSAGE } from "@/lib/validation";

const initialCreateUserState: CreateUserState = { error: null };

function inputClasses(tone: "dark" | "light") {
  return tone === "light"
    ? "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
    : "min-h-10 w-full rounded-lg border border-[var(--border)] bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:bg-white/[0.08]";
}

function Field({
  label,
  name,
  required = false,
  children,
  tone,
}: {
  label: string;
  name: string;
  required?: boolean;
  children: React.ReactNode;
  tone: "dark" | "light";
}) {
  return (
    <label
      htmlFor={name}
      className={`grid gap-2 text-sm ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}
    >
      <span className={`text-xs font-semibold ${tone === "light" ? "text-slate-700" : "text-[var(--brand-secondary)]"}`}>
        {label}{required ? <span className="ml-1 text-rose-700" aria-hidden>*</span> : null}
        {required ? <span className="sr-only"> (obligatorio)</span> : null}
      </span>
      {children}
    </label>
  );
}

export function CreateUserForm({
  actor,
  companyId,
  returnPath,
  clientOnly = false,
  tone = "dark",
}: {
  actor: UserProfile;
  companyId: string | null;
  returnPath: string;
  clientOnly?: boolean;
  tone?: "dark" | "light";
}) {
  const [state, formAction, pending] = useActionState(createUserAction, initialCreateUserState);
  const [title, setTitle] = useState("");
  const roles = clientOnly
    ? USER_ROLES.filter((role) => role.startsWith("client_"))
    : companyId
      ? USER_ROLES
      : USER_ROLES.filter((role) => !role.startsWith("client_"));
  const fieldClasses = inputClasses(tone);
  const titleIsEmpty = title.trim().length === 0;

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="companyId" value={companyId ?? "internal"} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Nombre" name="name" required tone={tone}>
        <input id="name" name="name" required className={fieldClasses} />
      </Field>
      <Field label="Email" name="email" required tone={tone}>
        <input id="email" name="email" type="email" required className={fieldClasses} />
      </Field>
      <Field label="Cargo" name="title" required tone={tone}>
        <input
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          pattern=".*\\S.*"
          aria-describedby="title-requirement"
          className={fieldClasses}
          onInvalid={(event) => event.currentTarget.setCustomValidity(REQUIRED_USER_TITLE_MESSAGE)}
          onInput={(event) => event.currentTarget.setCustomValidity("")}
        />
        <span id="title-requirement" className={`text-xs ${tone === "light" ? "text-slate-600" : "text-[var(--muted)]"}`}>
          {REQUIRED_USER_TITLE_MESSAGE}
        </span>
      </Field>
      <Field label="Contraseña inicial" name="password" required tone={tone}>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className={fieldClasses}
          placeholder="Mínimo 8 caracteres"
        />
      </Field>
      <Field label="Rol" name="role" tone={tone}>
        <select id="role" name="role" className={fieldClasses} defaultValue={roles[0]}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </Field>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || titleIsEmpty}
        className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
          tone === "light" ? "bg-[#5b48c7] hover:bg-[#4936ad]" : "bg-[#4330a6] hover:bg-[#37258f]"
        }`}
      >
        {pending ? "Creando usuario…" : "Invitar usuario"}
      </button>
    </form>
  );
}
