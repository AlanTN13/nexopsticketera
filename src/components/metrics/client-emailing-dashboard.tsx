"use client";

/* eslint-disable @typescript-eslint/no-unused-vars, react/no-unescaped-entities */

import React, { useState, useMemo } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  MousePointerClick,
  Users,
  AlertTriangle,
  Search,
  ExternalLink,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  BarChart2,
  Info,
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Percent,
  X,
  FileText,
  ShieldAlert,
  UserX,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Client, MailchimpCampaignRow } from "@/features/metrics/types";
import { calculateMailchimpMetrics } from "@/features/metrics/csv-parser";

interface ClientEmailingDashboardProps {
  client: Client;
  rows: MailchimpCampaignRow[];
  hasSourceData: boolean;
  dateRangeLabel: string;
}

export const ClientEmailingDashboard: React.FC<ClientEmailingDashboardProps> = ({
  client,
  rows,
  hasSourceData,
  dateRangeLabel,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"date" | "opens" | "clicks" | "openRate" | "sent">("date");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [selectedCampaignModal, setSelectedCampaignModal] = useState<MailchimpCampaignRow | null>(null);

  // Aggregated KPIs
  const metrics = useMemo(() => {
    return calculateMailchimpMetrics(rows);
  }, [rows]);

  // Filtered & Sorted campaigns
  const displayedCampaigns = useMemo(() => {
    return rows
      .filter((row) => {
        const matchesSearch =
          row.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.campaignName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.previewText.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.campaignId.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType =
          selectedTypeFilter === "all" || row.type.toLowerCase() === selectedTypeFilter.toLowerCase();

        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        switch (sortField) {
          case "date":
            valA = new Date(a.sendDate).getTime() || 0;
            valB = new Date(b.sendDate).getTime() || 0;
            break;
          case "opens":
            valA = a.uniqueOpens;
            valB = b.uniqueOpens;
            break;
          case "clicks":
            valA = a.uniqueClicks;
            valB = b.uniqueClicks;
            break;
          case "openRate":
            valA = a.openRate;
            valB = b.openRate;
            break;
          case "sent":
            valA = a.emailsSent;
            valB = b.emailsSent;
            break;
        }

        if (sortDirection === "desc") {
          return valA > valB ? -1 : valA < valB ? 1 : 0;
        } else {
          return valA > valB ? 1 : valA < valB ? -1 : 0;
        }
      });
  }, [rows, searchTerm, selectedTypeFilter, sortField, sortDirection]);

  // Prepare chart data (chronological)
  const chartData = useMemo(() => {
    return [...rows]
      .sort((a, b) => new Date(a.sendDate).getTime() - new Date(b.sendDate).getTime())
      .map((row) => {
        const shortDate = row.rawSendDate ? row.rawSendDate.split(" ")[0] : row.sendDate.substring(5);
        return {
          date: shortDate,
          fullDate: row.rawSendDate || row.sendDate,
          subject: row.subject,
          aperturas: row.uniqueOpens,
          clics: row.uniqueClicks,
          openRate: row.openRate,
          ctor: row.ctor,
          ctr: row.ctr,
          enviados: row.emailsSent,
        };
      });
  }, [rows]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // If no campaigns detected for this client
  if (rows.length === 0) {
    return (
      <div className="p-4 sm:p-5">
        {/* Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs sm:p-8">
          <div className="w-12 h-12 bg-violet-50 text-[#4330a6] rounded-xl flex items-center justify-center mx-auto mb-4 border border-violet-200 shadow-xs">
            <Mail className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            {hasSourceData
              ? `No hay campañas en ${dateRangeLabel.toLowerCase()}`
              : `Todavía no hay campañas disponibles para ${client.name}`}
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
            {hasSourceData
              ? "Probá con un rango más amplio o elegí Todo el histórico."
              : "Cuando existan envíos asociados a tu empresa vas a ver aquí su rendimiento. Si esperabas información, escribinos desde Soporte."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 sm:p-5">
      {/* Top Banner / Account Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#4330a6] text-white shrink-0 shadow-xs font-bold text-lg">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                Emailing y Mailchimp
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-violet-50 text-violet-800 px-2.5 py-0.5 rounded-full border border-violet-200 ">
                Cuenta: {client.mailchimpName || client.accountName}
              </span>
              {rows[0]?.audience && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  <Users className="w-3 h-3 text-slate-500" />
                  Audiencia: {rows[0].audience}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Reportería consolidada de campañas regulares, aperturas, clics y entregabilidad.
            </p>
          </div>
        </div>

        {/* Global summary badge */}
        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5">
          <div>
            <span className="text-[10px] uppercase  tracking-wider text-slate-400 block font-medium">
              Campañas
            </span>
            <span className="text-lg font-bold text-slate-900 ">
              {metrics.totalCampaigns}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase  tracking-wider text-slate-400 block font-medium">
              Último envío
            </span>
            <span className="text-xs font-semibold text-slate-700  block mt-0.5">
              {rows[0]?.rawSendDate || rows[0]?.sendDate || "-"}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Entregabilidad & Envíos */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6b7280] ">
              Envíos & Entrega
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 ">
                {metrics.totalDelivered.toLocaleString("es-AR")}
              </span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                {metrics.deliveryRate}% Entrega
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              De <span className="font-semibold text-slate-600">{metrics.totalSent.toLocaleString("es-AR")}</span> correos enviados
            </p>
          </div>
        </div>

        {/* 2. Aperturas & Open Rate */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6b7280] ">
              Tasa de apertura
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 ">
                {metrics.avgOpenRate}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                ({metrics.totalUniqueOpens.toLocaleString("es-AR")} únicas)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              <span className="font-semibold text-slate-600">{metrics.totalOpens.toLocaleString("es-AR")}</span> aperturas totales acumuladas
            </p>
          </div>
        </div>

        {/* 3. Clics, CTR & CTOR */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6b7280] ">
              Clics & CTOR
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 ">
                {metrics.totalUniqueClicks.toLocaleString("es-AR")}
              </span>
              <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/50" title="Click to Open Rate: Clics / Aperturas">
                {metrics.avgCtor}% CTOR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              CTR Promedio: <span className="font-semibold text-slate-700">{metrics.avgCtr}%</span> ({metrics.totalClicks} clics totales)
            </p>
          </div>
        </div>

        {/* 4. Higiene de Lista (Bajas & Rebotes) */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6b7280] ">
              Higiene & Bajas
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 ">
                {metrics.totalUnsubscribes}
              </span>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {metrics.avgUnsubscribeRate}% Bajas
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics.totalBounces} rebotes ({metrics.avgBounceRate}%) • {metrics.totalAbuseReports} quejas spam
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-700" />
              Evolución por campaña
            </h2>
            <p className="text-xs text-slate-500">
              Aperturas únicas y tasa de apertura (Open Rate %) a lo largo de las fechas de envío
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600 ">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-700" /> Aperturas Únicas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600" /> Open Rate %
            </span>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                unit="%"
                domain={[0, "auto"]}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg text-xs max-w-xs space-y-1">
                        <p className="font-bold text-slate-100 truncate">{data.subject}</p>
                        <p className="text-slate-400 ">{data.fullDate}</p>
                        <div className="pt-1.5 space-y-1 border-t border-slate-800">
                          <p className="flex justify-between">
                            <span className="text-slate-300">Aperturas Únicas:</span>
                            <span className=" font-bold text-slate-100">{data.aperturas}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-slate-300">Open Rate:</span>
                            <span className=" font-bold text-violet-300">{data.openRate}%</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-slate-300">Clics Únicos:</span>
                            <span className=" font-bold text-amber-400">{data.clics}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-slate-300">CTOR (Interacción):</span>
                            <span className=" font-bold text-cyan-300">{data.ctor}%</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-slate-300">Enviados:</span>
                            <span className=" text-slate-400">{data.enviados}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar yAxisId="left" dataKey="aperturas" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Line yAxisId="right" type="monotone" dataKey="openRate" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3.5, fill: "#6366f1" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Campaigns Table Header & Filters */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-600" />
              Historial de Campañas Enviadas ({displayedCampaigns.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hacé clic en una campaña para consultar entregas, rebotes y reportes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por asunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 w-48 lg:w-64"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px] ">
                <th
                  onClick={() => toggleSort("date")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Fecha Envío</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Asunto & Campaña</th>
                <th
                  onClick={() => toggleSort("sent")}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Entregados</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("opens")}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Aperturas</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("openRate")}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Open Rate</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("clicks")}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Clics (CTR/CTOR)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Bajas & Rebotes</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {displayedCampaigns.map((camp) => (
                <tr
                  key={camp.campaignId}
                  onClick={() => setSelectedCampaignModal(camp)}
                  className="hover:bg-amber-50/30 transition-colors cursor-pointer group"
                >
                  {/* Fecha */}
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600  text-[11px]">
                    <div className="font-semibold text-slate-800">
                      {camp.rawSendDate ? camp.rawSendDate.split(" ")[0] : camp.sendDate}
                    </div>
                    {camp.rawSendDate && camp.rawSendDate.includes(" ") && (
                      <span className="text-slate-400 text-[10px]">
                        {camp.rawSendDate.split(" ")[1]}
                      </span>
                    )}
                  </td>

                  {/* Asunto & Preview */}
                  <td className="py-3 px-4 max-w-xs md:max-w-md">
                    <div className="font-semibold text-slate-900 line-clamp-1 group-hover:text-amber-800 transition-colors">
                      {camp.subject}
                    </div>
                    {camp.previewText && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {camp.previewText}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px]  bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                        ID: {camp.campaignId}
                      </span>
                      {camp.type && (
                        <span className="text-[9px] uppercase  bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded">
                          {camp.type}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Entregados */}
                  <td className="py-3 px-4 text-right whitespace-nowrap ">
                    <span className="font-bold text-slate-900">
                      {camp.emailsDelivered.toLocaleString("es-AR")}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      de {camp.emailsSent.toLocaleString("es-AR")}
                    </span>
                  </td>

                  {/* Aperturas */}
                  <td className="py-3 px-4 text-right whitespace-nowrap ">
                    <span className="font-bold text-emerald-700">
                      {camp.uniqueOpens.toLocaleString("es-AR")}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {camp.totalOpens} totales
                    </span>
                  </td>

                  {/* Open Rate */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${Math.min(camp.openRate * 2.5, 100)}%` }}
                        />
                      </div>
                      <span className="font-bold  text-slate-900 text-xs">
                        {camp.openRate}%
                      </span>
                    </div>
                  </td>

                  {/* Clics (CTR / CTOR) */}
                  <td className="py-3 px-4 text-right whitespace-nowrap ">
                    <div className="font-bold text-violet-900">
                      {camp.uniqueClicks} clics
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      CTR: {camp.ctr}% • CTOR: {camp.ctor}%
                    </span>
                  </td>

                  {/* Bajas & Rebotes */}
                  <td className="py-3 px-4 text-right whitespace-nowrap ">
                    <span className="text-slate-700 font-medium">
                      {camp.unsubscribes} bajas ({camp.unsubscribeRate}%)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {camp.bounces} rebotes ({camp.bounceRate}%)
                    </span>
                  </td>

                  {/* Detalle button */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCampaignModal(camp);
                      }}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px] hover:bg-amber-100 hover:text-amber-900 transition-colors cursor-pointer"
                    >
                      Detalle
                    </button>
                  </td>
                </tr>
              ))}

              {displayedCampaigns.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No se encontraron campañas que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Detail Drawer for selected Campaign */}
      {selectedCampaignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase  font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                    Informe de Campaña Mailchimp
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {selectedCampaignModal.subject}
                  </h3>
                  <p className="text-xs text-slate-500  mt-0.5">
                    Enviado el {selectedCampaignModal.rawSendDate || selectedCampaignModal.sendDate} • ID: {selectedCampaignModal.campaignId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCampaignModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Preview Text Box */}
              {selectedCampaignModal.previewText && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase  font-semibold text-slate-400 block mb-1">
                    Texto Preliminar (Preheader)
                  </span>
                  <p className="text-xs text-slate-700 italic">
                    "{selectedCampaignModal.previewText}"
                  </p>
                </div>
              )}

              {/* Grid Metrics */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase  tracking-wider mb-3">
                  Rendimiento & Interacción
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200/60 rounded-xl">
                    <span className="text-[10px] text-emerald-800  uppercase block font-medium">
                      Open Rate
                    </span>
                    <span className="text-xl font-bold text-emerald-700 ">
                      {selectedCampaignModal.openRate}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {selectedCampaignModal.uniqueOpens.toLocaleString("es-AR")} aperturas
                    </span>
                  </div>

                  <div className="p-3 bg-violet-50/50 border border-violet-200/60 rounded-xl">
                    <span className="text-[10px] text-violet-800  uppercase block font-medium">
                      CTOR (Interacción)
                    </span>
                    <span className="text-xl font-bold text-violet-700 ">
                      {selectedCampaignModal.ctor}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Clics / Aperturas
                    </span>
                  </div>

                  <div className="p-3 bg-blue-50/50 border border-blue-200/60 rounded-xl">
                    <span className="text-[10px] text-blue-800  uppercase block font-medium">
                      CTR (Total Clics)
                    </span>
                    <span className="text-xl font-bold text-blue-700 ">
                      {selectedCampaignModal.ctr}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {selectedCampaignModal.uniqueClicks} clics únicos
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <span className="text-[10px] text-slate-600  uppercase block font-medium">
                      Entregados
                    </span>
                    <span className="text-xl font-bold text-slate-900 ">
                      {selectedCampaignModal.emailsDelivered.toLocaleString("es-AR")}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      de {selectedCampaignModal.emailsSent.toLocaleString("es-AR")} enviados
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Breakdown & Health */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase  tracking-wider mb-3">
                  Desglose de Entregabilidad & Salud
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 text-xs">
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-slate-600">Rebotes Blandos (Soft Bounces - buzón lleno/temporal):</span>
                    <span className=" font-bold text-slate-800">{selectedCampaignModal.softBounces}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-slate-600">Rebotes Duros (Hard Bounces - correo inexistente):</span>
                    <span className=" font-bold text-amber-700">{selectedCampaignModal.hardBounces}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-slate-600">Errores de Sintaxis:</span>
                    <span className=" font-bold text-slate-800">{selectedCampaignModal.syntaxErrors}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-slate-600">Desuscripciones (Bajas):</span>
                    <span className=" font-bold text-slate-900">{selectedCampaignModal.unsubscribes} ({selectedCampaignModal.unsubscribeRate}%)</span>
                  </div>
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-slate-600">Reportes de Abuso / Spam:</span>
                    <span className=" font-bold text-red-600">{selectedCampaignModal.abuseReports}</span>
                  </div>
                </div>
              </div>

              {/* Activity Timestamps */}
              {(selectedCampaignModal.lastOpen || selectedCampaignModal.lastClick || selectedCampaignModal.lastUpdated) && (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase  tracking-wider mb-2">
                    Trazabilidad Temporal
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs ">
                    {selectedCampaignModal.lastOpen && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Última Apertura</span>
                        <span className="text-slate-800 font-semibold">{selectedCampaignModal.lastOpen}</span>
                      </div>
                    )}
                    {selectedCampaignModal.lastClick && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Último Clic</span>
                        <span className="text-slate-800 font-semibold">{selectedCampaignModal.lastClick}</span>
                      </div>
                    )}
                    {selectedCampaignModal.lastUpdated && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Última Sincronización</span>
                        <span className="text-slate-800 font-semibold">{selectedCampaignModal.lastUpdated}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedCampaignModal(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cerrar Informe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
