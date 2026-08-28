import { PasswordRecoveryRequestForm } from "@/components/password-recovery-request-form";

export const dynamic = "force-dynamic";

export default function PasswordRecoveryRequestPage() {
  return (
    <main className="min-h-screen bg-[#eef0fa] px-5 py-8 sm:px-6 lg:px-10">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-[rgba(67,48,166,0.16)] bg-white p-6 shadow-[0_16px_50px_rgba(17,24,39,0.08)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-tertiary)]">
          Recuperación de acceso
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#1b1638]">
          Recuperá tu contraseña
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#4f5375]">
          Ingresá el email de tu cuenta. Te enviaremos un enlace de un solo uso para elegir una contraseña nueva.
        </p>
        <div className="mt-6">
          <PasswordRecoveryRequestForm />
        </div>
      </section>
    </main>
  );
}
