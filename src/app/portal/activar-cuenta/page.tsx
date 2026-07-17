import { redirect } from "next/navigation";

import { AccountActivationForm } from "@/components/account-activation-form";
import { getClientSessionActorId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountActivationPage() {
  const actorId = await getClientSessionActorId();

  if (!actorId) {
    redirect("/portal/login?reason=invite");
  }

  return (
    <main className="min-h-screen bg-[#eef0fa] px-5 py-8 sm:px-6 lg:px-10">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-[rgba(67,48,166,0.16)] bg-white p-6 shadow-[0_16px_50px_rgba(17,24,39,0.08)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-tertiary)]">
          Activación de cuenta
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#1b1638]">
          Elegí tu contraseña
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#4f5375]">
          Configurá una contraseña para ingresar al portal en tus próximos accesos.
        </p>
        <div className="mt-6">
          <AccountActivationForm />
        </div>
      </section>
    </main>
  );
}
