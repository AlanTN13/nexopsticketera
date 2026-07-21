"use client";

import { ComponentProps, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type FormActionResult = void | { error?: string | null };
type ServerFormAction = (formData: FormData) => FormActionResult | Promise<FormActionResult>;

export function createSubmissionGuard() {
  let pending = false;

  return async function runOnce<T>(action: () => Promise<T>) {
    if (pending) return undefined;
    pending = true;
    try {
      return await action();
    } finally {
      pending = false;
    }
  };
}

export function PendingForm({
  action,
  children,
  className,
}: {
  action: ServerFormAction;
  children: ReactNode;
  className?: string;
}) {
  const guard = useRef(createSubmissionGuard());
  const [error, setError] = useState<string | null>(null);

  async function guardedAction(formData: FormData) {
    try {
      setError(null);
      const result = await guard.current(() => Promise.resolve(action(formData)));
      if (result && typeof result === "object" && "error" in result) {
        setError(result.error ?? null);
      }
    } catch {
      setError("No pudimos completar la acción. Revisá los datos e intentá nuevamente.");
    }
  }

  return (
    <form action={guardedAction} className={className}>
      {children}
      {error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function ActionStateForm({
  action,
  pending,
  children,
  className,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  children: ReactNode;
  className?: string;
}) {
  const submitted = useRef(false);
  const observedPending = useRef(false);

  useEffect(() => {
    if (pending) {
      observedPending.current = true;
      return;
    }

    if (observedPending.current) {
      submitted.current = false;
      observedPending.current = false;
    }
  }, [pending]);

  function preventDuplicateSubmit(event: FormEvent<HTMLFormElement>) {
    if (submitted.current) {
      event.preventDefault();
      return;
    }

    submitted.current = true;
  }

  return (
    <form action={action} className={className} onSubmitCapture={preventDuplicateSubmit}>
      {children}
    </form>
  );
}

export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "children" | "type"> & {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
