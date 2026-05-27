import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateTicketForm, LogoutClientForm } from "@/components/forms";
import { EmptyState } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildPortalStats, filterTickets, sortTickets } from "@/lib/queries";
import { areaLabels, priorityLabels, statusLabels, typeLabels } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

type PortalPageProps = {
  searchParams: Promise<{
    status?: string;
    area?: string;
    priority?: string;
  }>;
};

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { status, area, priority } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);

  if (!actor) {
    redirect("/login");
  }

  const companyTickets = actor.companyId
    ? db.tickets.filter((ticket) => ticket.companyId === actor.companyId)
    : [];
  const tickets = sortTickets(
    filterTickets(companyTickets, { status, area, priority }),
  );
  const stats = buildPortalStats(companyTickets);
  const latestTicket = tickets[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="rounded-[30px] border border-[rgba(67,48,166,0.16)] bg-white/72 px-5 py-4 shadow-[0_24px_70px_rgba(124,91,255,0.12)] backdrop-blur sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7c5bff,#4330a6)] text-lg font-black text-white shadow-[0_16px_40px_rgba(124,91,255,0.28)]">
              N
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-[#1b1638]">NexOps</p>
              <p className="font-[family-name:var(--font-montserrat)] text-xs uppercase tracking-[0.28em] text-[#5b48c7]">
                Portal cliente
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[rgba(67,48,166,0.14)] bg-white/80 px-3 py-1.5 text-xs text-[#1b1638]">
              {actor.name}
            </span>
            <Link
              href="/portal/users"
              className="text-sm font-medium text-[#4330a6] transition hover:text-[#1b1638]"
            >
              Usuarios
            </Link>
            <LogoutClientForm tone="light" />
          </div>
        </div>
      </header>

      <main className="mt-8 grid gap-8">
        <section className="rounded-[34px] border border-[rgba(196,198,255,0.7)] bg-[linear-gradient(180deg,rgba(248,247,255,0.97),rgba(237,233,255,0.95))] p-6 text-[#1b1638] shadow-[0_30px_100px_rgba(6,4,20,0.24)] sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-[rgba(124,91,255,0.18)] bg-white/80 px-4 py-1.5 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                Soporte de tu cuenta
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-black tracking-[-0.05em] text-[#1b1638] sm:text-5xl">
                  Reportá una incidencia o pedí una mejora desde un solo lugar.
                </h1>
                <p className="max-w-2xl text-[15px] leading-7 text-[#5a5d7f]">
                  Cargá tickets para tu empresa y seguí la respuesta de NexOps sin perder trazabilidad compartida.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#nuevo-ticket"
                  className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(124,91,255,0.22)] transition hover:translate-y-[-1px]"
                >
                  Crear ticket
                </a>
                <a
                  href="#seguimiento"
                  className="inline-flex items-center rounded-full border border-[rgba(91,72,199,0.16)] bg-white/80 px-5 py-3 text-sm font-semibold text-[#4330a6] transition hover:border-[#7c5bff]"
                >
                  Ver seguimiento
                </a>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <CompactInfo
                  title="Incidencia"
                  detail="Errores, interrupciones, caídas o algo que dejó de funcionar."
                />
                <CompactInfo
                  title="Mejora"
                  detail="Cambios o ajustes para mejorar un flujo ya existente."
                />
                <CompactInfo
                  title="Seguimiento"
                  detail="Estado, prioridad, comentarios y próximos pasos en línea."
                />
              </div>
            </div>

            <aside className="rounded-[30px] border border-[rgba(124,91,255,0.12)] bg-white/88 p-6 shadow-[0_18px_40px_rgba(124,91,255,0.08)]">
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                Qué pasa después
              </p>
              <ol className="mt-4 grid gap-4 text-sm leading-6 text-[#5a5d7f]">
                <StepRow index="1" title="Recibimos el contexto" detail="Título, descripción, área y prioridad para arrancar mejor." />
                <StepRow index="2" title="Priorizamos el ticket" detail="NexOps revisa el caso y define el curso de trabajo." />
                <StepRow index="3" title="Te respondemos en el mismo portal" detail="Seguís avances, comentarios y cambios de estado desde acá." />
              </ol>

              <div className="mt-6 grid gap-3">
                <SoftMetric label="Abiertos" value={stats.open} />
                <SoftMetric label="Críticos" value={stats.critical} />
                <SoftMetric label="Tickets visibles" value={stats.total} />
              </div>
            </aside>
          </div>
        </section>

        <section
          id="nuevo-ticket"
          className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start"
        >
          <div className="rounded-[32px] border border-[rgba(196,198,255,0.74)] bg-white p-6 text-[#1b1638] shadow-[0_24px_70px_rgba(6,4,20,0.18)] sm:p-8">
            <div className="mb-6 space-y-2">
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                Nuevo ticket
              </p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#1b1638]">
                Contanos qué necesitás resolver.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-[#5a5d7f]">
                Elegí si es una incidencia o una mejora, sumá el detalle principal y definí la prioridad.
              </p>
            </div>
            <CreateTicketForm actor={actor} tone="light" />
          </div>

          <div className="grid gap-4">
            <SupportNote
              title="Qué conviene incluir"
              detail="Impacto en la operación, pasos para reproducir, mensaje de error y cualquier evidencia que ayude a entender el caso."
            />
            <SupportNote
              title="Cuándo usar incidencia"
              detail="Si algo dejó de funcionar, se interrumpió una integración o el comportamiento es distinto a lo esperado."
            />
            <SupportNote
              title="Cuándo usar mejora"
              detail="Si querés pedir un ajuste sobre un flujo existente o una optimización puntual para tu equipo."
            />
          </div>
        </section>

        <section
          id="seguimiento"
          className="rounded-[32px] border border-[rgba(196,198,255,0.74)] bg-[linear-gradient(180deg,rgba(249,248,255,0.97),rgba(239,236,255,0.94))] p-6 text-[#1b1638] shadow-[0_24px_70px_rgba(6,4,20,0.18)] sm:p-8"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                Seguimiento
              </p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#1b1638]">
                Tus tickets recientes y en curso.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-[#5a5d7f]">
                Revisá el estado de los tickets compartidos de tu empresa sin perder de vista lo importante.
              </p>
            </div>
            {latestTicket ? (
              <div className="rounded-[22px] border border-[rgba(91,72,199,0.14)] bg-white/80 px-4 py-3 text-sm text-[#5a5d7f]">
                Última actualización: <span className="font-semibold text-[#1b1638]">{latestTicket.code}</span>
              </div>
            ) : null}
          </div>

          <form className="mt-6 grid gap-3 md:grid-cols-4">
            <select
              name="status"
              defaultValue={status ?? "all"}
              className="rounded-[18px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638] outline-none transition focus:border-[#7c5bff]"
            >
              <option value="all">Todos los estados</option>
              <option value="new">Nuevo</option>
              <option value="analysis">En análisis</option>
              <option value="in_progress">En progreso</option>
              <option value="waiting_for_client">Esperando cliente</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
            <select
              name="area"
              defaultValue={area ?? "all"}
              className="rounded-[18px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638] outline-none transition focus:border-[#7c5bff]"
            >
              <option value="all">Todas las áreas</option>
              <option value="automation">Automatizaciones</option>
              <option value="custom_system">Sistema custom</option>
              <option value="website">Sitios web</option>
              <option value="ai_agent">Agentes IA</option>
              <option value="crm">CRM</option>
              <option value="erp">ERP</option>
            </select>
            <select
              name="priority"
              defaultValue={priority ?? "all"}
              className="rounded-[18px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638] outline-none transition focus:border-[#7c5bff]"
            >
              <option value="all">Todas las prioridades</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
            <button
              type="submit"
              className="rounded-[18px] border border-[rgba(91,72,199,0.16)] bg-[#1b1638] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#120f2c]"
            >
              Aplicar filtros
            </button>
          </form>

          <div className="mt-6 grid gap-4">
            {tickets.length > 0 ? (
              tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/portal/tickets/${ticket.id}`}
                  className="rounded-[26px] border border-[rgba(91,72,199,0.14)] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(124,91,255,0.08)] transition hover:border-[#7c5bff] hover:shadow-[0_18px_40px_rgba(124,91,255,0.12)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#f1edff] px-3 py-1 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b48c7]">
                          {ticket.code}
                        </span>
                        <span className="rounded-full border border-[rgba(91,72,199,0.12)] bg-white px-3 py-1 text-xs font-medium text-[#4330a6]">
                          {typeLabels[ticket.type]}
                        </span>
                        <span className="rounded-full border border-[rgba(91,72,199,0.12)] bg-white px-3 py-1 text-xs font-medium text-[#4330a6]">
                          {areaLabels[ticket.area]}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-[#1b1638]">{ticket.title}</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5a5d7f]">
                          {ticket.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid min-w-[220px] gap-2 text-sm text-[#5a5d7f]">
                      <TicketMeta label="Estado" value={statusLabels[ticket.status]} />
                      <TicketMeta label="Prioridad" value={priorityLabels[ticket.priority]} />
                      <TicketMeta label="Actualizado" value={new Intl.DateTimeFormat("es-AR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(ticket.updatedAt))} />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[28px] border border-[rgba(91,72,199,0.16)] bg-white/78 p-1">
                <EmptyState
                  title="Todavía no hay tickets para estos filtros"
                  detail="Cuando cargues el primero, lo vas a poder seguir desde esta misma sección."
                  tone="light"
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function CompactInfo({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-[rgba(91,72,199,0.12)] bg-white/72 p-4">
      <p className="text-sm font-bold tracking-tight text-[#1b1638]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#5a5d7f]">{detail}</p>
    </div>
  );
}

function StepRow({
  index,
  title,
  detail,
}: {
  index: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex gap-3 rounded-[22px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-sm font-bold text-white">
        {index}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#1b1638]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#5a5d7f]">{detail}</p>
      </div>
    </li>
  );
}

function SoftMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-[20px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] px-4 py-3">
      <span className="text-sm text-[#5a5d7f]">{label}</span>
      <span className="text-lg font-black tracking-[-0.04em] text-[#1b1638]">{value}</span>
    </div>
  );
}

function SupportNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-white/76 p-5 shadow-[0_18px_40px_rgba(124,91,255,0.08)]">
      <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
        Orientación
      </p>
      <p className="mt-3 text-lg font-bold tracking-tight text-[#1b1638]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#5a5d7f]">{detail}</p>
    </div>
  );
}

function TicketMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#f7f5ff] px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b74a6]">{label}</span>
      <span className="text-right font-semibold text-[#1b1638]">{value}</span>
    </div>
  );
}
