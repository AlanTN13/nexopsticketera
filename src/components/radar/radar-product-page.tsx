import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Compass,
  ExternalLink,
  FileSearch,
  Fingerprint,
  Gauge,
  RadioTower,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

import { RadarShell, type RadarView } from "@/components/radar/radar-shell";
import { getRadarProductContext } from "@/lib/radar-context";
import {
  RADAR_STRATEGY,
  type RadarProductModel,
  type RadarProductOpportunity,
} from "@/lib/radar-product";
import type { RadarPublication, RadarSourceState } from "@/lib/radar-workspace";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Sin actividad registrada";
}

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Sin actividad registrada";
}

function ViewHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">{eyebrow}</p>
        <h1 className="mt-3 font-[family-name:var(--font-montserrat)] text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{description}</p>
      </div>
      {meta ? <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-400">{meta}</span> : null}
    </header>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-3xl border border-dashed border-white/12 bg-white/[0.025] px-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[0.05] text-slate-500"><FileSearch size={22} /></span>
        <h2 className="mt-4 font-[family-name:var(--font-montserrat)] text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <span className="relative grid size-14 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#a78bfa ${score * 3.6}deg, rgba(255,255,255,.08) 0deg)` }}>
      <span className="absolute inset-[3px] rounded-full bg-[#0d1928]" />
      <span className="relative text-sm font-bold text-white">{score}</span>
    </span>
  );
}

function StateTag({ status }: { status: RadarProductOpportunity["status"] }) {
  return status === "published" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200"><Check size={12} /> Publicada</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-[11px] font-bold text-slate-300"><X size={12} /> Descartada</span>
  );
}

function SourceStateBadge({ state }: { state: RadarSourceState }) {
  const copy = {
    ready: { label: "Conectada", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" },
    unavailable: { label: "Pendiente", className: "border-amber-300/20 bg-amber-300/10 text-amber-100" },
    error: { label: "Con inconvenientes", className: "border-rose-400/20 bg-rose-400/10 text-rose-100" },
  }[state];
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${copy.className}`}>{copy.label}</span>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Compass;
  label: string;
  value: string | number;
  detail: string;
  tone: "violet" | "green" | "blue" | "amber";
}) {
  const tones = {
    violet: "border-violet-400/15 bg-violet-400/8 text-violet-200",
    green: "border-emerald-400/15 bg-emerald-400/8 text-emerald-200",
    blue: "border-sky-400/15 bg-sky-400/8 text-sky-200",
    amber: "border-amber-300/15 bg-amber-300/8 text-amber-100",
  }[tone];

  return (
    <article className="rounded-3xl border border-white/8 bg-white/[0.035] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.16)]">
      <div className={`grid size-10 place-items-center rounded-2xl border ${tones}`}><Icon size={18} /></div>
      <p className="mt-5 text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-montserrat)] text-3xl font-bold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function OpportunityCard({ opportunity, compact = false }: { opportunity: RadarProductOpportunity; compact?: boolean }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/8 bg-[#0b1726]/90 transition hover:-translate-y-0.5 hover:border-violet-300/20 hover:shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
      {opportunity.imageUrl && !compact ? (
        <div className="relative aspect-[16/8] overflow-hidden bg-[#101d2e]">
          <Image src={opportunity.imageUrl} alt="" fill unoptimized sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover opacity-80 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1726] via-transparent to-transparent" />
        </div>
      ) : null}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StateTag status={opportunity.status} />
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-400">{opportunity.category}</span>
          </div>
          <ScoreRing score={opportunity.score} />
        </div>
        <h2 className="mt-5 font-[family-name:var(--font-montserrat)] text-xl font-bold leading-7 tracking-[-0.02em] text-white">{opportunity.title}</h2>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{opportunity.summary}</p>
        <div className={`mt-5 rounded-2xl border p-4 ${opportunity.status === "published" ? "border-emerald-400/12 bg-emerald-400/[0.055]" : "border-white/8 bg-white/[0.025]"}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Decisión de Radar</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{opportunity.explanation}</p>
        </div>
        <details className="mt-4 rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-violet-200">Ver evidencia y criterios</summary>
          <div className="mt-4 grid gap-3">
            {opportunity.reasons.length ? opportunity.reasons.map((reason) => (
              <div key={reason.dimension} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-4">
                <div>
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-300">{reason.label}</span><span className="text-slate-500">{reason.score}/100</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${reason.score}%` }} /></div>
                </div>
              </div>
            )) : <p className="text-xs text-slate-500">La fuente no publicó el detalle de dimensiones para esta decisión.</p>}
          </div>
        </details>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4 text-xs text-slate-500">
          <span>{formatDate(opportunity.occurredAt)} · {opportunity.sourceName}</span>
          <div className="flex items-center gap-3">
            <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-slate-300 hover:text-white">Fuente <ExternalLink size={12} /></a>
            {opportunity.finalUrl ? <a href={opportunity.finalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-violet-200 hover:text-white">Ver publicación <ArrowUpRight size={13} /></a> : null}
          </div>
        </footer>
      </div>
    </article>
  );
}

function OverviewView({ model, companyName }: { model: RadarProductModel; companyName: string }) {
  const featured = model.opportunities.slice(0, 3);
  const needsAttention = model.health.state !== "healthy";

  return (
    <div className="grid gap-8">
      <section className="relative overflow-hidden rounded-[32px] border border-violet-300/14 bg-[linear-gradient(135deg,rgba(124,58,237,.18),rgba(14,165,233,.055)_46%,rgba(255,255,255,.025))] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.28)] sm:p-8 lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-10 lg:p-10">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-200"><Sparkles size={13} /> Inteligencia editorial autónoma</span>
          <h1 className="mt-5 max-w-3xl font-[family-name:var(--font-montserrat)] text-3xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Radar encuentra oportunidades y las convierte en contenido con criterio.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Observa el mercado de {companyName}, filtra el ruido y publica únicamente cuando una oportunidad supera los controles de negocio, marca y fuente.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/portal/radar/oportunidades" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-bold text-white shadow-[0_14px_36px_rgba(124,58,237,.34)] transition hover:bg-violet-400">Explorar oportunidades <ChevronRight size={16} /></Link>
            <Link href="/portal/radar/estrategia" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white">Ver estrategia activa</Link>
          </div>
        </div>

        <div className="relative mt-8 grid place-items-center lg:mt-0">
          <div className="absolute size-72 rounded-full border border-violet-300/10" />
          <div className="absolute size-52 rounded-full border border-violet-300/15" />
          <div className="absolute size-32 rounded-full border border-violet-300/20" />
          <div className="absolute h-px w-64 rotate-45 bg-gradient-to-r from-transparent via-violet-300/45 to-transparent" />
          <div className="relative z-10 w-full max-w-[270px] rounded-3xl border border-white/10 bg-[#081421]/85 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-violet-400/12 text-violet-200"><RadioTower size={19} /></span><span className={`size-2 rounded-full ${model.health.state === "healthy" ? "bg-emerald-400" : model.health.state === "limited" ? "bg-amber-300" : "bg-rose-400"}`} /></div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Trabajando ahora</p>
            <p className="mt-2 text-lg font-bold text-white">Monitoreo activo</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">Próximo ciclo programado para el próximo día hábil a las 09:00.</p>
            <p className="mt-4 border-t border-white/8 pt-4 text-xs text-slate-500">Última actividad · {formatDateTime(model.latestActivityAt)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Resultados de Radar">
        <MetricCard icon={Compass} label="Oportunidades registradas" value={model.opportunities.length} detail="Decisiones con trazabilidad de negocio" tone="violet" />
        <MetricCard icon={BookOpenCheck} label="Publicadas y verificadas" value={model.publications.length} detail="Contenido actualmente en producción" tone="green" />
        <MetricCard icon={ShieldCheck} label="Descartadas" value={model.rejected.length} detail="Ruido que Radar evitó publicar" tone="blue" />
        <MetricCard icon={TrendingUp} label="Puntaje promedio" value={model.averageScore ?? "—"} detail="Calidad de las decisiones visibles" tone="amber" />
      </section>

      {needsAttention ? (
        <Link href="/portal/radar/historial" className="flex flex-col gap-4 rounded-3xl border border-amber-300/16 bg-amber-300/[0.055] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-100"><CircleAlert size={18} /></span><div><p className="font-semibold text-amber-50">{model.health.label}</p><p className="mt-1 text-sm leading-6 text-amber-100/65">{model.health.detail}</p></div></div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-100">Revisar estado <ChevronRight size={14} /></span>
        </Link>
      ) : null}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">Decisiones recientes</p><h2 className="mt-2 font-[family-name:var(--font-montserrat)] text-2xl font-bold text-white">Lo que Radar puso a trabajar</h2></div>
          <Link href="/portal/radar/oportunidades" className="hidden items-center gap-1 text-xs font-bold text-violet-200 hover:text-white sm:inline-flex">Ver todas <ChevronRight size={14} /></Link>
        </div>
        {featured.length ? <div className="grid gap-5 xl:grid-cols-2">{featured.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} compact />)}</div> : <EmptyState title="Todavía no hay decisiones visibles" detail="Las oportunidades aparecerán cuando Radar complete un ciclo con datos válidos." />}
      </section>
    </div>
  );
}

function OpportunitiesView({ model, filter }: { model: RadarProductModel; filter: "all" | "published" | "discarded" }) {
  const opportunities = filter === "all" ? model.opportunities : model.opportunities.filter((item) => item.status === filter);
  const filters = [
    { value: "all", label: "Todas" },
    { value: "published", label: "Publicadas" },
    { value: "discarded", label: "Descartadas" },
  ] as const;

  return (
    <div className="grid gap-7">
      <ViewHeader eyebrow="Oportunidades" title="Ideas que merecieron una decisión" description="Radar explica qué encontró, qué valor detectó y por qué decidió publicar o proteger el foco de la marca." meta={`${model.opportunities.length} decisiones`} />
      <div className="flex flex-wrap gap-2" aria-label="Filtrar oportunidades">
        {filters.map((item) => <Link key={item.value} href={item.value === "all" ? "/portal/radar/oportunidades" : `/portal/radar/oportunidades?estado=${item.value}`} aria-current={filter === item.value ? "page" : undefined} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${filter === item.value ? "border-violet-300/25 bg-violet-400/15 text-violet-100" : "border-white/8 bg-white/[0.025] text-slate-500 hover:text-white"}`}>{item.label}</Link>)}
      </div>
      {opportunities.length ? <section className="grid gap-5 xl:grid-cols-2">{opportunities.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} />)}</section> : <EmptyState title="No hay oportunidades en este estado" detail="Radar actualizará esta vista automáticamente cuando registre una decisión nueva." />}
    </div>
  );
}

function PublicationRow({ publication }: { publication: RadarPublication }) {
  return (
    <article className="grid overflow-hidden rounded-3xl border border-white/8 bg-[#0b1726]/90 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="relative min-h-44 bg-gradient-to-br from-violet-500/15 to-sky-500/5">
        {publication.imageUrl ? <Image src={publication.imageUrl} alt="" fill unoptimized sizes="220px" className="object-cover opacity-90" /> : <span className="absolute inset-0 grid place-items-center text-violet-300/45"><ScanSearch size={40} /></span>}
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200"><Check size={12} /> Verificada</span><span className="text-xs text-slate-500">{publication.category}</span></div><span className="text-xs font-bold text-violet-200">Score {publication.score}/100</span></div>
        <h2 className="mt-4 font-[family-name:var(--font-montserrat)] text-xl font-bold leading-7 text-white">{publication.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{publication.reason}</p>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><CalendarClock size={14} /> {formatDate(publication.publishedAt)}</span><a href={publication.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-violet-200 hover:text-white">Abrir publicación <ArrowUpRight size={14} /></a></footer>
      </div>
    </article>
  );
}

function PublishedView({ model }: { model: RadarProductModel }) {
  return (
    <div className="grid gap-7">
      <ViewHeader eyebrow="Publicadas" title="Contenido que Radar puso a trabajar" description="Cada pieza está vinculada con una oportunidad, una fuente y una decisión verificable. No hay publicaciones de demostración." meta={`${model.publications.length} verificadas`} />
      {model.publications.length ? <section className="grid gap-4">{model.publications.map((publication) => <PublicationRow key={publication.id} publication={publication} />)}</section> : <EmptyState title="Todavía no hay publicaciones" detail="Las piezas aparecerán acá después de superar los controles y quedar verificadas en producción." />}
    </div>
  );
}

function HistoryView({ model }: { model: RadarProductModel }) {
  return (
    <div className="grid gap-7">
      <ViewHeader eyebrow="Historial" title="Todo lo que Radar decidió" description="Una línea de tiempo comercial para entender qué hizo el sistema sin leer workflows, logs ni infraestructura." meta={`${model.events.length} eventos`} />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-white/8 bg-[#0b1726]/80 p-5 sm:p-7">
          {model.events.length ? <ol className="grid gap-0">{model.events.map((event, index) => <li key={event.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-4 pb-7 last:pb-0"><div className="relative flex justify-center"><span className={`relative z-10 mt-1 size-2.5 rounded-full ${event.tone === "success" ? "bg-emerald-400" : event.tone === "attention" ? "bg-rose-400" : "bg-slate-500"}`} />{index < model.events.length - 1 ? <span className="absolute bottom-[-4px] top-3 w-px bg-white/8" /> : null}</div><div><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-white">{event.title}</p><time className="text-[11px] text-slate-500">{formatDateTime(event.occurredAt)}</time></div><p className="mt-2 text-sm leading-6 text-slate-400">{event.detail}</p><p className="mt-2 font-mono text-[10px] text-slate-600">{event.reference}</p></div></li>)}</ol> : <EmptyState title="El historial completo se está habilitando" detail="Las publicaciones siguen operativas y verificadas. NexOps está completando la conexión de las decisiones descartadas." />}
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Estado del producto</p><p className="mt-3 text-lg font-bold text-white">{model.health.label}</p><p className="mt-2 text-sm leading-6 text-slate-400">{model.health.detail}</p></div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Fuentes</p><div className="mt-4 grid gap-3">{model.sources.map((source) => <div key={source.label} className="flex items-center justify-between gap-3 border-b border-white/8 pb-3 last:border-0 last:pb-0"><span className="text-sm text-slate-300">{source.label}</span><SourceStateBadge state={source.state} /></div>)}</div></div>
        </aside>
      </section>
    </div>
  );
}

function StrategyView() {
  return (
    <div className="grid gap-7">
      <ViewHeader eyebrow="Estrategia" title="Las reglas comerciales que orientan a Radar" description="El producto muestra objetivos y límites en lenguaje de negocio. Los criterios propietarios permanecen protegidos." meta="Configuración activa" />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <article className="rounded-3xl border border-white/8 bg-[#0b1726]/85 p-5 sm:p-7"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-400/10 text-violet-200"><Target size={18} /></span><div><h2 className="font-[family-name:var(--font-montserrat)] text-lg font-bold text-white">Objetivos de negocio</h2><p className="mt-1 text-sm text-slate-500">Qué resultados debe favorecer el Radar.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{RADAR_STRATEGY.goals.map((goal, index) => <div key={goal} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">{index === 0 ? "Principal" : "Secundario"}</span><p className="mt-2 text-sm font-semibold leading-5 text-white">{goal}</p></div>)}</div></article>
          <article className="rounded-3xl border border-white/8 bg-[#0b1726]/85 p-5 sm:p-7"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-400/10 text-sky-200"><Fingerprint size={18} /></span><div><h2 className="font-[family-name:var(--font-montserrat)] text-lg font-bold text-white">Territorios de marca</h2><p className="mt-1 text-sm text-slate-500">Temas donde Radar concentra la búsqueda.</p></div></div><div className="mt-5 flex flex-wrap gap-2">{RADAR_STRATEGY.topics.map((topic) => <span key={topic} className="rounded-full border border-sky-300/15 bg-sky-300/[0.07] px-3 py-2 text-xs font-semibold text-sky-100">{topic}</span>)}</div></article>
          <article className="rounded-3xl border border-white/8 bg-[#0b1726]/85 p-5 sm:p-7"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200"><ShieldCheck size={18} /></span><div><h2 className="font-[family-name:var(--font-montserrat)] text-lg font-bold text-white">Guardrails de marca</h2><p className="mt-1 text-sm text-slate-500">Condiciones que el sistema debe respetar siempre.</p></div></div><ul className="mt-5 grid gap-3 sm:grid-cols-2">{RADAR_STRATEGY.safeguards.map((guardrail) => <li key={guardrail} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm leading-6 text-slate-300"><Check className="mt-1 shrink-0 text-emerald-300" size={14} />{guardrail}</li>)}</ul></article>
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-3xl border border-violet-300/14 bg-gradient-to-br from-violet-500/14 to-sky-500/[0.04] p-6"><span className="grid size-11 place-items-center rounded-2xl bg-violet-400/12 text-violet-200"><Gauge size={20} /></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">Modo de operación</p><h2 className="mt-2 text-xl font-bold text-white">Autónomo con límites visibles</h2><dl className="mt-5 grid gap-4 text-sm"><div><dt className="text-slate-500">Autonomía</dt><dd className="mt-1 font-semibold text-white">{RADAR_STRATEGY.autonomy}</dd></div><div><dt className="text-slate-500">Selectividad</dt><dd className="mt-1 font-semibold text-white">{RADAR_STRATEGY.selectivity}</dd></div><div><dt className="text-slate-500">Fuentes</dt><dd className="mt-1 font-semibold text-white">{RADAR_STRATEGY.sourcePreference}</dd></div><div><dt className="text-slate-500">Máximo semanal</dt><dd className="mt-1 font-semibold text-white">{RADAR_STRATEGY.maximumPerWeek} publicaciones</dd></div></dl></div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-5"><div className="flex items-center gap-2 text-sm font-bold text-white"><Clock3 size={16} className="text-sky-300" /> Cadencia activa</div><div className="mt-4 flex flex-wrap gap-2">{RADAR_STRATEGY.enabledDays.map((day) => <span key={day} className="grid size-9 place-items-center rounded-xl bg-white/[0.05] text-[11px] font-bold text-slate-300">{day}</span>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Ciclo diario a las 09:00. Sólo las excepciones requieren intervención.</p></div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><div className="flex items-start gap-3"><Activity size={17} className="mt-0.5 shrink-0 text-violet-300" /><p className="text-xs leading-5 text-slate-400">Esta versión muestra la estrategia activa y protege los criterios propietarios. La edición autoservicio se incorporará en la próxima evolución del producto.</p></div></div>
        </aside>
      </section>
    </div>
  );
}

export type RadarProductScreenContext = {
  actorName: string;
  companyName: string;
  workspaceId: string;
  model: RadarProductModel;
  exitHref: string;
  exitLabel: string;
};

export function RadarProductScreen({
  view,
  opportunityFilter = "all",
  context,
}: {
  view: RadarView;
  opportunityFilter?: "all" | "published" | "discarded";
  context: RadarProductScreenContext;
}) {
  return (
    <RadarShell
      active={view}
      actorName={context.actorName}
      companyName={context.companyName}
      workspaceId={context.workspaceId}
      health={context.model.health}
      exitHref={context.exitHref}
      exitLabel={context.exitLabel}
    >
      {view === "overview" ? <OverviewView model={context.model} companyName={context.companyName} /> : null}
      {view === "opportunities" ? <OpportunitiesView model={context.model} filter={opportunityFilter} /> : null}
      {view === "published" ? <PublishedView model={context.model} /> : null}
      {view === "history" ? <HistoryView model={context.model} /> : null}
      {view === "strategy" ? <StrategyView /> : null}
    </RadarShell>
  );
}

export async function RadarProductPage({
  view,
  opportunityFilter = "all",
}: {
  view: RadarView;
  opportunityFilter?: "all" | "published" | "discarded";
}) {
  const context = await getRadarProductContext();
  const workspaceName = context.internalActor ? "NexOps" : context.company.name;

  return (
    <RadarProductScreen
      view={view}
      opportunityFilter={opportunityFilter}
      context={{
        actorName: context.actor.name,
        companyName: workspaceName,
        workspaceId: context.workspace.workspaceId,
        model: context.model,
        exitHref: context.exitHref,
        exitLabel: context.exitLabel,
      }}
    />
  );
}
