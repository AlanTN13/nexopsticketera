import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginClientForm } from "@/components/login-client-form";
import { getAuthenticatedActor, isInternalActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const db = await getAppSnapshot();
  const authenticatedActor = await getAuthenticatedActor(db);

  if (authenticatedActor) {
    redirect(isInternalActor(authenticatedActor) ? "/backoffice" : "/portal");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#efeefe_0%,#dfe3ff_100%)] px-5 py-8 sm:px-6 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(196,198,255,0.55),transparent_52%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
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

            <h1 className="mt-8 text-4xl font-black tracking-[-0.06em] text-[#18123a] sm:text-5xl lg:text-6xl">
              Accedé a tu portal cliente.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-[#4f5375]">
              Ingresá para reportar incidencias, seguir tickets y mantener el contexto de tu cuenta en un solo lugar.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <FeatureCard
                title="Reportar incidencias"
                detail="Cargá problemas con prioridad y detalle desde una interfaz simple."
              />
              <FeatureCard
                title="Seguir tickets"
                detail="Revisá estado, comentarios y últimas actualizaciones sin salir del portal."
              />
            </div>
          </section>

          <section className="justify-self-end w-full max-w-xl rounded-[32px] border border-[rgba(67,48,166,0.18)] bg-[rgba(255,252,255,0.92)] p-7 shadow-[0_30px_120px_rgba(124,91,255,0.16)] backdrop-blur sm:p-8">
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

            <div className="mt-8">
              <LoginClientForm />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(67,48,166,0.14)] pt-5 text-sm text-[#4f5375]">
              <span>¿Necesitás ayuda con tu acceso?</span>
              <Link href="mailto:soporte@nexops.io" className="text-[var(--brand-tertiary)] transition hover:text-[#1b1638]">
                Contactar soporte
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-[rgba(67,48,166,0.14)] bg-white/54 p-5 backdrop-blur">
      <p className="text-base font-bold tracking-tight text-[#1b1638]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#4f5375]">{detail}</p>
    </div>
  );
}
