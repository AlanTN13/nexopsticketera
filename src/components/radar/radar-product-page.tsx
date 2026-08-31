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
  Compass,
  ExternalLink,
  FileSearch,
  Fingerprint,
  Gauge,
  Globe2,
  RadioTower,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";

import { RadarShell, type RadarView } from "@/components/radar/radar-shell";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { updateRadarPreferencesAction } from "@/app/portal/radar/estrategia/actions";
import { getRadarProductContext } from "@/lib/radar-context";
import {
  RADAR_STRATEGY,
  type RadarProductModel,
  type RadarProductOpportunity,
} from "@/lib/radar-product";
import type { RadarPublication, RadarSourceState } from "@/lib/radar-workspace";
import {
  RADAR_PUBLICATIONS_PER_WEEK,
  RADAR_TOPIC_OPTIONS,
  type RadarPreferences,
} from "@/lib/radar-preferences";

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
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6749c7]">{eyebrow}</p>
        <h1 className="mt-2 font-[family-name:var(--font-montserrat)] text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
      </div>
      {meta ? <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">{meta}</span> : null}
    </header>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"><FileSearch size={20} /></span>
        <h2 className="mt-4 font-[family-name:var(--font-montserrat)] text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <span className="relative grid size-12 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#6749c7 ${score * 3.6}deg, #e2e8f0 0deg)` }}>
      <span className="absolute inset-[3px] rounded-full bg-white" />
      <span className="relative text-xs font-bold text-slate-900">{score}</span>
    </span>
  );
}

function StateTag({ status }: { status: RadarProductOpportunity["status"] }) {
  return status === "published" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><Check size={12} /> Publicada</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"><X size={12} /> Descartada</span>
  );
}

function SourceStateBadge({ state }: { state: RadarSourceState }) {
  const copy = {
    ready: { label: "Conectada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    unavailable: { label: "Pendiente", className: "border-amber-200 bg-amber-50 text-amber-800" },
    error: { label: "Con inconvenientes", className: "border-rose-200 bg-rose-50 text-rose-700" },
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
    violet: "bg-violet-50 text-[#5b3db8]",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-800",
  }[tone];

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 place-items-center rounded-lg ${tones}`}><Icon size={15} /></span>
        <p className="text-xs font-semibold text-slate-600">{label}</p>
      </div>
      <p className="mt-3 font-[family-name:var(--font-montserrat)] text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function OpportunityCard({ opportunity, compact = false }: { opportunity: RadarProductOpportunity; compact?: boolean }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-[#b9a9ef] hover:shadow-[0_16px_40px_rgba(55,35,120,0.08)]">
      {opportunity.imageUrl && !compact ? (
        <div className="relative aspect-[16/7] overflow-hidden bg-slate-100">
          <Image src={opportunity.imageUrl} alt="" fill unoptimized sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.015]" />
        </div>
      ) : null}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StateTag status={opportunity.status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{opportunity.category}</span>
          </div>
          <ScoreRing score={opportunity.score} />
        </div>
        <h2 className="mt-5 font-[family-name:var(--font-montserrat)] text-xl font-bold leading-7 tracking-[-0.02em] text-slate-950">{opportunity.title}</h2>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{opportunity.summary}</p>
        <div className={`mt-5 rounded-xl border p-4 ${opportunity.status === "published" ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Decisión</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{opportunity.explanation}</p>
        </div>
        <details className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-[#5b3db8]">Ver evidencia y criterios</summary>
          <div className="mt-4 grid gap-3">
            {opportunity.reasons.length ? opportunity.reasons.map((reason) => (
              <div key={reason.dimension} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-4">
                <div>
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-700">{reason.label}</span><span className="text-slate-500">{reason.score}/100</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6749c7]" style={{ width: `${reason.score}%` }} /></div>
                </div>
              </div>
            )) : <p className="text-xs text-slate-500">La fuente no publicó el detalle de dimensiones para esta decisión.</p>}
          </div>
        </details>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>{formatDate(opportunity.occurredAt)} · {opportunity.sourceName}</span>
          <div className="flex items-center gap-3">
            <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-950">Fuente <ExternalLink size={12} /></a>
            {opportunity.finalUrl ? <a href={opportunity.finalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#5b3db8] hover:text-[#43299c]">Ver publicación <ArrowUpRight size={13} /></a> : null}
          </div>
        </footer>
      </div>
    </article>
  );
}

function OverviewView({ model, companyName }: { model: RadarProductModel; companyName: string }) {
  const featured = model.opportunities.slice(0, 2);
  const needsAttention = model.health.state !== "healthy";

  return (
    <div className="grid gap-9">
      <section className="grid gap-7 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6749c7]">Radar · {companyName}</p>
          <h1 className="mt-3 max-w-2xl font-[family-name:var(--font-montserrat)] text-3xl font-bold leading-tight tracking-[-0.03em] text-slate-950 sm:text-4xl">Oportunidades y contenido, en un solo lugar.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">Revisá qué encontró Radar, qué decidió publicar y qué descartó para cuidar el foco de la marca.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/portal/radar/oportunidades" className="radar-primary-action inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#4f35b5] px-4 text-sm font-bold text-white transition hover:bg-[#43299c]">Ver oportunidades <ChevronRight size={16} /></Link>
            <Link href="/portal/radar/estrategia" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950">Configurar estrategia</Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-white text-[#5b3db8] shadow-sm ring-1 ring-slate-200"><RadioTower size={17} /></span>
            <span className={`size-2 rounded-full ${model.health.state === "healthy" ? "bg-emerald-500" : model.health.state === "limited" ? "bg-amber-500" : "bg-rose-500"}`} />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-900">Monitoreo activo</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Próximo ciclo: día hábil a las 09:00.</p>
          <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">Última actividad · {formatDateTime(model.latestActivityAt)}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Resumen de Radar">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><h2 className="text-sm font-bold text-slate-900">Resumen</h2><p className="mt-1 text-xs text-slate-500">Actividad registrada en este workspace.</p></div>
          <span className="text-xs font-semibold text-slate-500">Puntaje promedio {model.averageScore ?? "—"}</span>
        </div>
        <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <MetricCard icon={Compass} label="Oportunidades" value={model.opportunities.length} detail="Decisiones registradas" tone="violet" />
          <MetricCard icon={BookOpenCheck} label="Publicadas" value={model.publications.length} detail="Contenido en producción" tone="green" />
          <MetricCard icon={ShieldCheck} label="Descartadas" value={model.rejected.length} detail="Ideas que no avanzaron" tone="blue" />
        </div>
      </section>

      {needsAttention ? (
        <Link href="/portal/radar/historial" className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700 shadow-sm ring-1 ring-amber-200"><CircleAlert size={18} /></span><div><p className="font-semibold text-amber-950">{model.health.label}</p><p className="mt-1 text-sm leading-6 text-amber-800">{model.health.detail}</p></div></div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">Revisar estado <ChevronRight size={14} /></span>
        </Link>
      ) : null}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6749c7]">Decisiones recientes</p><h2 className="mt-2 font-[family-name:var(--font-montserrat)] text-2xl font-bold text-slate-950">Últimas oportunidades evaluadas</h2></div>
          <Link href="/portal/radar/oportunidades" className="hidden items-center gap-1 text-xs font-bold text-[#5b3db8] hover:text-[#43299c] sm:inline-flex">Ver todas <ChevronRight size={14} /></Link>
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
        {filters.map((item) => <Link key={item.value} href={item.value === "all" ? "/portal/radar/oportunidades" : `/portal/radar/oportunidades?estado=${item.value}`} aria-current={filter === item.value ? "page" : undefined} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${filter === item.value ? "border-[#cfc3f4] bg-[#eeeafe] text-[#43299c]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"}`}>{item.label}</Link>)}
      </div>
      {opportunities.length ? <section className="grid gap-5 xl:grid-cols-2">{opportunities.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} />)}</section> : <EmptyState title="No hay oportunidades en este estado" detail="Radar actualizará esta vista automáticamente cuando registre una decisión nueva." />}
    </div>
  );
}

function PublicationRow({ publication }: { publication: RadarPublication }) {
  return (
    <article className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="relative min-h-44 bg-slate-100">
        {publication.imageUrl ? <Image src={publication.imageUrl} alt="" fill unoptimized sizes="220px" className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-slate-400"><ScanSearch size={40} /></span>}
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><Check size={12} /> Verificada</span><span className="text-xs text-slate-500">{publication.category}</span></div><span className="text-xs font-bold text-[#5b3db8]">Score {publication.score}/100</span></div>
        <h2 className="mt-4 font-[family-name:var(--font-montserrat)] text-xl font-bold leading-7 text-slate-950">{publication.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{publication.reason}</p>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><CalendarClock size={14} /> {formatDate(publication.publishedAt)}</span><a href={publication.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-[#5b3db8] hover:text-[#43299c]">Abrir publicación <ArrowUpRight size={14} /></a></footer>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          {model.events.length ? <ol className="grid gap-0">{model.events.map((event, index) => <li key={event.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-4 pb-7 last:pb-0"><div className="relative flex justify-center"><span className={`relative z-10 mt-1 size-2.5 rounded-full ${event.tone === "success" ? "bg-emerald-500" : event.tone === "attention" ? "bg-rose-500" : "bg-slate-400"}`} />{index < model.events.length - 1 ? <span className="absolute bottom-[-4px] top-3 w-px bg-slate-200" /> : null}</div><div><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-slate-900">{event.title}</p><time className="text-[11px] text-slate-500">{formatDateTime(event.occurredAt)}</time></div><p className="mt-2 text-sm leading-6 text-slate-600">{event.detail}</p><p className="mt-2 font-mono text-[10px] text-slate-400">{event.reference}</p></div></li>)}</ol> : <EmptyState title="El historial completo se está habilitando" detail="Las publicaciones siguen operativas y verificadas. NexOps está completando la conexión de las decisiones descartadas." />}
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Estado</p><p className="mt-3 text-lg font-bold text-slate-900">{model.health.label}</p><p className="mt-2 text-sm leading-6 text-slate-600">{model.health.detail}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Fuentes</p><div className="mt-4 grid gap-3">{model.sources.map((source) => <div key={source.label} className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 last:border-0 last:pb-0"><span className="text-sm text-slate-700">{source.label}</span><SourceStateBadge state={source.state} /></div>)}</div></div>
        </aside>
      </section>
    </div>
  );
}

function ChoiceCard({
  name,
  value,
  title,
  detail,
  defaultChecked,
  disabled = false,
}: {
  name: string;
  value: string;
  title: string;
  detail: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border p-4 transition ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50" : "cursor-pointer border-slate-200 bg-white hover:border-[#b9a9ef] hover:bg-[#faf9ff]"}`}>
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 size-4 accent-violet-500"
      />
      <span>
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">{detail}</span>
      </span>
    </label>
  );
}

function StrategyView({
  preferences,
  actorId,
  companyId,
  canManage,
  saved,
}: {
  preferences: RadarPreferences;
  actorId: string;
  companyId: string;
  canManage: boolean;
  saved: boolean;
}) {
  const customTopics = preferences.topics.filter(
    (topic) => !RADAR_TOPIC_OPTIONS.includes(topic as (typeof RADAR_TOPIC_OPTIONS)[number]),
  );

  return (
    <div className="grid gap-7">
      <ViewHeader eyebrow="Estrategia" title="Configurá cómo trabaja tu Radar" description="Elegí los temas, la frecuencia y el nivel de autonomía. El motor, los criterios de calidad y la seguridad siguen protegidos por NexOps." meta={canManage ? "Autogestión activa" : "Sólo lectura"} />

      {saved ? (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <Check size={17} /> Estrategia guardada. Radar usará esta configuración en sus próximos ciclos.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PendingForm action={updateRadarPreferencesAction} className="grid gap-5">
          <input type="hidden" name="actorId" value={actorId} />
          <input type="hidden" name="companyId" value={companyId} />

          <fieldset disabled={!canManage} className="grid gap-5 disabled:opacity-75">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><Fingerprint size={18} /></span>
                <div><h2 className="font-[family-name:var(--font-montserrat)] text-lg font-bold text-slate-900">Temáticas</h2><p className="mt-1 text-sm text-slate-600">Elegí entre 1 y 8 territorios donde Radar debe buscar oportunidades.</p></div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {RADAR_TOPIC_OPTIONS.map((topic) => (
                  <label key={topic} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-white">
                    <input type="checkbox" name="topics" value={topic} defaultChecked={preferences.topics.includes(topic)} className="size-4 accent-sky-400" />
                    {topic}
                  </label>
                ))}
              </div>
              <label className="mt-4 grid gap-2 text-xs font-semibold text-slate-600" htmlFor="customTopics">
                Otros temas, separados por coma
                <input id="customTopics" name="customTopics" defaultValue={customTopics.join(", ")} placeholder="Ej.: Logística, Turismo, Retail" maxLength={180} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#6749c7]" />
              </label>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-[#5b3db8]"><Gauge size={18} /></span>
                <div><h2 className="font-[family-name:var(--font-montserrat)] text-lg font-bold text-slate-900">Frecuencia semanal</h2><p className="mt-1 text-sm text-slate-600">Definí el máximo de piezas que Radar puede producir por semana.</p></div>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-2">
                {RADAR_PUBLICATIONS_PER_WEEK.map((frequency) => (
                  <label key={frequency} className="cursor-pointer">
                    <input type="radio" name="publicationsPerWeek" value={frequency} defaultChecked={preferences.publicationsPerWeek === frequency} className="peer sr-only" />
                    <span className="grid min-h-14 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 transition peer-checked:border-[#9f89e4] peer-checked:bg-[#eeeafe] peer-checked:text-[#43299c]">{frequency}</span>
                  </label>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-800"><Target size={18} /></span>
                <div><h2 className="font-[family-name:var(--font-montserrat)] text-lg font-bold text-slate-900">Oportunidades débiles</h2><p className="mt-1 text-sm text-slate-600">Decidí qué debe pasar cuando una idea no llega al nivel recomendado.</p></div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ChoiceCard name="opportunityBehavior" value="discard" title="Descartar automáticamente" detail="Radar protege el foco y guarda la decisión en el historial." defaultChecked={preferences.opportunityBehavior === "discard"} />
                <ChoiceCard name="opportunityBehavior" value="suggest" title="Dejar como sugerencia" detail="La idea queda visible para que el equipo decida qué hacer." defaultChecked={preferences.opportunityBehavior === "suggest"} />
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Globe2 size={18} /></span>
                <div><h2 className="font-[family-name:var(--font-montserrat)] text-lg font-bold text-slate-900">Publicación</h2><p className="mt-1 text-sm text-slate-600">Elegí si el contenido sale solo o queda listo para aprobar.</p></div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ChoiceCard name="publishingMode" value="review" title="Revisar antes de publicar" detail="Radar prepara la pieza y espera una aprobación del equipo." defaultChecked={preferences.publishingMode === "review"} />
                <ChoiceCard name="publishingMode" value="automatic" title="Publicar automáticamente" detail={preferences.siteIntegrated ? "El sitio está conectado: Radar publica apenas valida la pieza." : "Disponible cuando NexOps termine de conectar el sitio."} defaultChecked={preferences.publishingMode === "automatic"} disabled={!preferences.siteIntegrated} />
              </div>
            </article>
          </fieldset>

          {canManage ? (
            <PendingSubmitButton idleLabel="Guardar estrategia" pendingLabel="Guardando estrategia…" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#4f35b5] px-5 text-sm font-bold text-white transition hover:bg-[#43299c]" />
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Tu rol puede revisar esta configuración. Un administrador de la cuenta puede modificarla.</p>
          )}
        </PendingForm>

        <aside className="grid content-start gap-4">
          <div className="rounded-2xl border border-[#d8cff5] bg-[#faf9ff] p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-white text-[#5b3db8] shadow-sm ring-1 ring-[#d8cff5]"><SlidersHorizontal size={20} /></span>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#6749c7]">Configuración actual</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">{preferences.publicationsPerWeek} veces por semana</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <div><dt className="text-slate-500">Temáticas</dt><dd className="mt-1 font-semibold leading-6 text-slate-900">{preferences.topics.join(" · ")}</dd></div>
              <div><dt className="text-slate-500">Ideas débiles</dt><dd className="mt-1 font-semibold text-slate-900">{preferences.opportunityBehavior === "discard" ? "Se descartan" : "Quedan como sugerencia"}</dd></div>
              <div><dt className="text-slate-500">Publicación</dt><dd className="mt-1 font-semibold text-slate-900">{preferences.publishingMode === "automatic" ? "Automática" : "Con aprobación"}</dd></div>
            </dl>
          </div>
          <div className={`rounded-2xl border p-5 ${preferences.siteIntegrated ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Globe2 size={16} className={preferences.siteIntegrated ? "text-emerald-700" : "text-amber-700"} /> {preferences.siteIntegrated ? "Sitio conectado" : "Sitio pendiente de conexión"}</div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{preferences.siteIntegrated ? "Radar puede publicar directamente cuando el modo automático está activo." : "NexOps debe validar la integración antes de habilitar publicaciones automáticas."}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck size={16} className="text-emerald-600" /> Core protegido</div>
            <ul className="mt-4 grid gap-3">{RADAR_STRATEGY.safeguards.slice(0, 3).map((guardrail) => <li key={guardrail} className="flex items-start gap-2 text-xs leading-5 text-slate-600"><Check className="mt-0.5 shrink-0 text-emerald-600" size={13} />{guardrail}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-start gap-3"><Activity size={17} className="mt-0.5 shrink-0 text-[#6749c7]" /><p className="text-xs leading-5 text-slate-600">Estas preferencias cambian la operación comercial. Los umbrales, fuentes, seguridad y credenciales del motor no quedan expuestos.</p></div></div>
        </aside>
      </section>
    </div>
  );
}

export type RadarProductScreenContext = {
  actorName: string;
  actorId: string;
  companyName: string;
  companyId: string;
  workspaceId: string;
  model: RadarProductModel;
  preferences: RadarPreferences;
  canManagePreferences: boolean;
  exitHref: string;
  exitLabel: string;
};

export function RadarProductScreen({
  view,
  opportunityFilter = "all",
  saved = false,
  context,
}: {
  view: RadarView;
  opportunityFilter?: "all" | "published" | "discarded";
  saved?: boolean;
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
      {view === "strategy" ? <StrategyView preferences={context.preferences} actorId={context.actorId} companyId={context.companyId} canManage={context.canManagePreferences} saved={saved} /> : null}
    </RadarShell>
  );
}

export async function RadarProductPage({
  view,
  opportunityFilter = "all",
  saved = false,
}: {
  view: RadarView;
  opportunityFilter?: "all" | "published" | "discarded";
  saved?: boolean;
}) {
  const context = await getRadarProductContext();
  const workspaceName = context.internalActor ? "NexOps" : context.company.name;

  return (
    <RadarProductScreen
      view={view}
      opportunityFilter={opportunityFilter}
      saved={saved}
      context={{
        actorName: context.actor.name,
        actorId: context.actor.id,
        companyName: workspaceName,
        companyId: context.company.id,
        workspaceId: context.workspace.workspaceId,
        model: context.model,
        preferences: context.preferences,
        canManagePreferences: context.canManagePreferences,
        exitHref: context.exitHref,
        exitLabel: context.exitLabel,
      }}
    />
  );
}
