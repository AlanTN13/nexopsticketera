import { redirect } from "next/navigation";

import { LoginClientForm } from "@/components/login-client-form";
import { InlineNotice } from "@/components/ui";
import { getAuthenticatedActor, isInternalActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const db = await getAppSnapshot();
  const authenticatedActor = await getAuthenticatedActor(db);

  if (authenticatedActor) {
    redirect(isInternalActor(authenticatedActor) ? "/backoffice" : "/portal");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef0fa] px-5 py-6 sm:px-6 lg:px-10">
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="max-w-xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(67,48,166,0.18)] bg-white/60 px-4 py-2 backdrop-blur">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7c5bff,#4330a6)] text-sm font-black text-white">
                N
              </div>
              <div>
                <p className="text-sm font-bold text-[#211b45]">NexOps</p>
                <p className="font-[family-name:var(--font-montserrat)] text-[10px] uppercase tracking-[0.22em] text-[var(--brand-tertiary)]">
                  Client Portal
                </p>
              </div>
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] text-[#18123a] sm:text-5xl">
              Accedé a tu portal cliente.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-[#4f5375]">
              Ingresá para reportar incidencias, seguir tickets y mantener el contexto de tu operación en un solo lugar.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <FeatureCard
                title="Reportar incidencias"
                detail="Cargá problemas con impacto y contexto desde una interfaz simple."
              />
              <FeatureCard
                title="Seguir tickets"
                detail="Revisá estado, comentarios y últimas actualizaciones sin salir del portal."
              />
            </div>
          </section>

          <section className="w-full max-w-xl justify-self-end rounded-2xl border border-[rgba(67,48,166,0.16)] bg-white p-6 shadow-[0_16px_50px_rgba(17,24,39,0.08)] sm:p-7">
            <div className="space-y-3">
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--brand-tertiary)]">
                Login
              </p>
              <h2 className="text-3xl font-black tracking-[-0.05em] text-[#1b1638]">
                Ingresar
              </h2>
              <p className="text-sm leading-7 text-[#4f5375]">
                Usá tu email y contraseña para entrar a tu cuenta.
              </p>
            </div>

            {reason === "session" ? <div className="mt-5"><InlineNotice tone="error">Tu sesión venció. Ingresá nuevamente para continuar.</InlineNotice></div> : null}
            {reason === "invite" ? <div className="mt-5"><InlineNotice tone="error">El enlace de acceso no es válido o venció. Pedí una nueva invitación a NexOps.</InlineNotice></div> : null}
            <div className="mt-6">
              <LoginClientForm />
            </div>

          </section>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[rgba(67,48,166,0.14)] bg-white/70 p-4">
      <p className="text-base font-bold tracking-tight text-[#1b1638]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#4f5375]">{detail}</p>
    </div>
  );
}
