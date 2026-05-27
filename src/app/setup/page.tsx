import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { AppShell, NavButton, SectionCard } from "@/components/ui";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { withActor } from "@/lib/routing";
import { isSupabaseConfigured, SUPABASE_URL } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);
  if (!actor) {
    redirect("/portal/login");
  }
  const supabaseReady = isSupabaseConfigured();

  return (
    <AppShell
      eyebrow="Setup Supabase"
      title="Conexión del backend real"
      description="La base técnica ya está encaminada. Esta vista resume qué falta para pasar del demo persistente a una operación real sobre Supabase."
      actions={
        <>
          <NavButton href={withActor("/", actor.id)} label="Inicio" muted />
          <NavButton href={withActor("/backoffice", actor.id)} label="Backoffice" />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard title="Variables de entorno" description="Copiá .env.example a .env.local y completá las credenciales del proyecto de Supabase.">
          <div className="rounded-[28px] border border-[var(--border)] bg-[#0d0a20] p-5">
            <pre className="overflow-x-auto text-sm leading-7 text-[var(--muted)]">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=`}
            </pre>
          </div>
          {supabaseReady ? (
            <p className="mt-4 text-sm leading-6 text-emerald-700">
              Conexión activa contra <strong>{SUPABASE_URL}</strong>.
            </p>
          ) : null}
        </SectionCard>
        <SectionCard title="Migración inicial" description="El archivo base está en supabase/migrations/001_initial_schema.sql e incluye:">
          <ul className="grid gap-2 text-sm leading-6 text-[var(--muted)]">
            <li>Enums para tipo, área, prioridad, estado y rol.</li>
            <li>Tablas companies, users, tickets, comments, attachments e history.</li>
            <li>Funciones auxiliares para permisos y RLS multiempresa.</li>
            <li>Bucket de storage ticket-attachments con políticas de acceso.</li>
          </ul>
        </SectionCard>
        <SectionCard title="Qué queda al conectar Supabase" description="La UI ya está pensada para ese backend; el demo solo cubre la persistencia local temporal.">
          <ul className="grid gap-2 text-sm leading-6 text-[var(--muted)]">
            <li>Reemplazar el store demo por lecturas y mutaciones reales con Supabase Postgres.</li>
            <li>Mapear auth.users hacia la tabla users del dominio.</li>
            <li>Agregar upload real de adjuntos y recuperación segura por policy.</li>
            <li>Activar login y recuperación de contraseña desde Auth.</li>
          </ul>
        </SectionCard>
        <SectionCard title="Criterios cubiertos en esta implementación" description="Lo más importante del plan ya quedó bajado a producto.">
          <ul className="grid gap-2 text-sm leading-6 text-[var(--muted)]">
            <li>Portal cliente con dashboard, filtros, detalle, comentarios y gestión de usuarios.</li>
            <li>Backoffice con cola general, filtros, asignación manual y cambio de workflow.</li>
            <li>Modelo multiempresa con simulación de permisos por actor.</li>
            <li>Trazabilidad con historial persistente en modo demo.</li>
          </ul>
        </SectionCard>
      </div>
    </AppShell>
  );
}
