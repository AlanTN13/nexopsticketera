"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleDot,
  Clock3,
  Radio,
  RefreshCw,
} from "lucide-react";

import styles from "@/components/radar/radar-live-operation.module.css";
import type { RadarRequestKind, RadarRunEvent, RadarRunStatus } from "@/lib/radar-control-plane";
import { getRadarLiveView } from "@/lib/radar-live-status";

type RadarLiveOperationProps = {
  runId: string;
  status: RadarRunStatus;
  requestKind: RadarRequestKind;
  createdAt: string;
  updatedAt: string;
  events: RadarRunEvent[];
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function elapsedLabel(from: string, now: number | null) {
  if (now === null) return "Calculando…";
  const seconds = Math.max(0, Math.floor((now - Date.parse(from)) / 1_000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

function ElapsedClock({ from, label }: { from: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(clock);
    };
  }, []);

  return <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> {label} {elapsedLabel(from, now)}</span>;
}

export function RadarLiveOperation({ runId, status, requestKind, createdAt, updatedAt, events }: RadarLiveOperationProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const eventTypes = events.map((event) => event.type);
  const view = getRadarLiveView(status, requestKind, eventTypes);
  const latestEvent = events.at(-1) ?? null;
  const refreshesAutomatically = view.mode === "working";

  useEffect(() => {
    if (!refreshesAutomatically) return;
    const refresh = window.setInterval(() => {
      startTransition(() => router.refresh());
    }, 5_000);
    return () => window.clearInterval(refresh);
  }, [refreshesAutomatically, router]);

  function refreshNow() {
    startTransition(() => router.refresh());
  }

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-violet-400/25 bg-[#070b1d] text-white shadow-[0_28px_90px_rgba(30,20,80,0.22)]" aria-labelledby="radar-live-title">
      <div className="pointer-events-none absolute -left-24 top-0 size-72 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 size-72 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative border-b border-white/10 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-300" /></span>
            Centro de operaciones · en vivo
          </span>
          <span className="font-mono text-[10px] text-slate-500">Misión {runId.slice(0, 8)}</span>
        </div>
      </div>

      <div className="relative grid gap-8 px-5 py-7 sm:px-7 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-12 lg:py-10">
        <div className="grid place-items-center">
          <div className={styles.nexyTeam} aria-label="Equipo de Nexys trabajando en la misión">
            <span className={styles.handoffLine} aria-hidden="true" />
            {view.stages.map((stage, index) => (
              <div
                key={stage.name}
                className={`${styles.nexyWorker} ${stage.state === "active" ? styles.nexyWorkerActive : stage.state === "done" ? styles.nexyWorkerDone : styles.nexyWorkerWaiting}`}
              >
                <Image
                  src={stage.imageSrc}
                  alt={`${stage.name}: ${stage.role}`}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 9rem, 11vw"
                  className={styles.nexyWorkerImage}
                />
                <div className={styles.nexyWorkerShade} aria-hidden="true" />
                {stage.state === "active" && view.mode === "working" ? <span className={styles.workSignal} aria-hidden="true" /> : null}
                <div className={styles.nexyWorkerLabel}>
                  <strong>{stage.name}</strong>
                  <span>{stage.state === "active" ? "Trabajando" : stage.state === "done" ? "Completado" : "En espera"}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="relative -mt-5 rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-center shadow-xl backdrop-blur">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Fase actual</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-200">{view.phaseLabel}</p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">Radar by NexOps</p>
          <h2 id="radar-live-title" className="mt-3 max-w-2xl text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">{view.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{view.description}</p>

          <ol className="mt-7 grid gap-2 sm:grid-cols-2" aria-label="Etapas de la misión">
            {view.stages.map((stage, index) => (
              <li key={stage.name} className={`rounded-xl border p-3.5 ${stage.state === "active" ? "border-violet-400/45 bg-violet-400/12" : stage.state === "done" ? "border-emerald-300/20 bg-emerald-300/8" : "border-white/8 bg-white/[0.025]"}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${stage.state === "active" ? "bg-violet-400 text-white shadow-[0_0_24px_rgba(139,92,246,0.45)]" : stage.state === "done" ? "bg-emerald-300/15 text-emerald-200" : "bg-white/5 text-slate-600"}`}>
                    {stage.state === "done" ? <Check size={15} /> : stage.state === "active" ? <CircleDot size={15} /> : index + 1}
                  </span>
                  <div><strong className={`block text-xs ${stage.state === "waiting" ? "text-slate-500" : "text-slate-100"}`}>{stage.name}</strong><span className={`mt-0.5 block text-[10px] leading-4 ${stage.state === "waiting" ? "text-slate-600" : "text-slate-400"}`}>{stage.role}</span></div>
                </div>
              </li>
            ))}
          </ol>

          {view.actionLabel ? <a href={`#run-${runId}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#39227f] shadow-lg transition hover:bg-violet-50">{view.actionLabel}</a> : null}
        </div>
      </div>

      <div className="relative grid gap-3 border-t border-white/10 bg-white/[0.025] px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-7">
        <div className="flex min-w-0 items-start gap-3" aria-live="polite">
          <Radio size={16} className="mt-0.5 shrink-0 text-emerald-300" />
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Última señal real</p><p className="mt-1 text-xs leading-5 text-slate-300">{latestEvent?.message ?? "Radar está registrando la primera señal."} <span className="text-slate-500">· {dateTimeFormatter.format(new Date(latestEvent?.createdAt ?? updatedAt))}</span></p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500">
          <ElapsedClock from={view.mode === "working" ? createdAt : updatedAt} label={view.mode === "working" ? "En curso hace" : "Resultado recibido hace"} />
          <button type="button" onClick={refreshNow} disabled={isRefreshing} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-slate-300 transition hover:bg-white/10 disabled:opacity-50"><RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? "Actualizando…" : refreshesAutomatically ? "Actualiza solo" : "Actualizar"}</button>
        </div>
      </div>
    </section>
  );
}
