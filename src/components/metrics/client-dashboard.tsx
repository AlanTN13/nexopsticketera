"use client";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  DollarSign,
  MessageSquare,
  TrendingUp,
  Users,
  Film,
  MousePointerClick,
  FileSpreadsheet,
  ShoppingBag,
  Filter,
  X,
  Check,
  Layers,
  Sparkles,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ExternalLink,
  ThumbsUp,
  SlidersHorizontal,
  Eye,
  Percent,
  Coins,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Client, SheetRow, AggregatedMetrics, CreativePerformance, CampaignBreakdown } from "@/features/metrics/types";
import {
  calculateAggregatedMetrics,
  aggregateByDay,
  aggregateByCreative,
  aggregateByCampaign,
  getObjectiveLabels,
} from "@/features/metrics/csv-parser";

interface ClientDashboardProps {
  client: Client;
  rows: SheetRow[];
  hasSourceData?: boolean;
  dateRangeLabel: string;
}

export type KpiId =
  | "amountSpent"
  | "impressions"
  | "cpm"
  | "clicks"
  | "cpc"
  | "ctr"
  | "conversations"
  | "costPerLead"
  | "conversions"
  | "costPerConversion"
  | "purchaseValue"
  | "followsOrLikes"
  | "roas";

export const DEFAULT_SELECTED_KPIS: KpiId[] = [
  "amountSpent",
  "impressions",
  "cpm",
  "clicks",
  "cpc",
  "ctr",
  "conversations",
  "costPerLead",
];

export type TableColumnKey =
  | "amountSpent"
  | "primaryMetricValue"
  | "costPerResult"
  | "impressions"
  | "cpm"
  | "clicks"
  | "cpc"
  | "ctr"
  | "conversations"
  | "costPerLead"
  | "conversions"
  | "costPerConversion"
  | "purchaseValue"
  | "roas"
  | "followsOrLikes"
  | "hookRate"
  | "retentionRate";

export const DEFAULT_TABLE_COLUMNS: TableColumnKey[] = [
  "amountSpent",
  "primaryMetricValue",
  "costPerResult",
  "impressions",
  "clicks",
  "cpc",
  "ctr",
  "roas",
  "hookRate",
  "retentionRate",
];

type MetricKey =
  | "amountSpent"
  | "primaryMetricValue"
  | "costPerResult"
  | "followsOrLikes"
  | "clicks"
  | "impressions"
  | "cpc"
  | "ctr"
  | "hookRate";

type CreativeSortField = "creativeName" | TableColumnKey;
type CampaignSortField = "campaignName" | TableColumnKey;

type SortDirection = "asc" | "desc";

export const ClientDashboard: React.FC<ClientDashboardProps> = ({
  client,
  rows,
  hasSourceData = rows.length > 0,
  dateRangeLabel,
}) => {
  const objective = client.objective || "CONVERSACIONES";
  const { primaryMetricLabel, costPerResultLabel, rateLabel } = getObjectiveLabels(objective);

  // 1. Interactive drill-down / filter state by campaign or creative
  const [selectedFilter, setSelectedFilter] = useState<{
    type: "campaign" | "creative";
    name: string;
  } | null>(null);

  // 1b. Customizable 8 Top KPI Indicators
  const [selectedKpis, setSelectedKpis] = useState<KpiId[]>(() => {
    try {
      const saved = localStorage.getItem(`nexops_kpis_${client.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 8) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SELECTED_KPIS;
  });

  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [tempKpiSelection, setTempKpiSelection] = useState<KpiId[]>(DEFAULT_SELECTED_KPIS);

  // 1c. Customizable Table Columns (Choose which indicators to see in table)
  const [selectedTableColumns, setSelectedTableColumns] = useState<TableColumnKey[]>(() => {
    try {
      const saved = localStorage.getItem(`nexops_table_cols_${client.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_TABLE_COLUMNS;
  });

  const [isTableColModalOpen, setIsTableColModalOpen] = useState(false);
  const [tempTableColSelection, setTempTableColSelection] = useState<TableColumnKey[]>(DEFAULT_TABLE_COLUMNS);

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatNumber = (val: number) => val.toLocaleString("es-AR");

  // Table Column Definitions Catalog
  const tableColumnDefinitions: Record<
    TableColumnKey,
    {
      id: TableColumnKey;
      label: string;
      shortLabel?: string;
      category: string;
      align?: "left" | "right" | "center";
      renderCell: (row: CreativePerformance | CampaignBreakdown) => React.ReactNode;
      getSortValue: (row: CreativePerformance | CampaignBreakdown) => number;
    }
  > = {
    amountSpent: {
      id: "amountSpent",
      label: "Inversión",
      category: "Inversión",
      align: "right",
      renderCell: (r) => <span className=" text-slate-900 font-medium">{formatCurrency(r.amountSpent)}</span>,
      getSortValue: (r) => r.amountSpent || 0,
    },
    primaryMetricValue: {
      id: "primaryMetricValue",
      label: primaryMetricLabel,
      category: "Resultados",
      align: "right",
      renderCell: (r) => <span className="font-bold text-slate-900">{formatNumber(r.primaryMetricValue)}</span>,
      getSortValue: (r) => r.primaryMetricValue || 0,
    },
    costPerResult: {
      id: "costPerResult",
      label: costPerResultLabel,
      shortLabel: "CP Resultado",
      category: "Costos",
      align: "right",
      renderCell: (r) => <span className=" font-semibold text-emerald-700">{formatCurrency(r.costPerResult)}</span>,
      getSortValue: (r) => r.costPerResult || 0,
    },
    impressions: {
      id: "impressions",
      label: "Impresiones",
      category: "Alcance",
      align: "right",
      renderCell: (r) => <span className=" text-slate-700">{formatNumber(r.impressions)}</span>,
      getSortValue: (r) => r.impressions || 0,
    },
    cpm: {
      id: "cpm",
      label: "CPM",
      category: "Costos",
      align: "right",
      renderCell: (r) => (
        <span className=" text-slate-700">
          {formatCurrency(r.impressions > 0 ? (r.amountSpent / r.impressions) * 1000 : 0)}
        </span>
      ),
      getSortValue: (r) => (r.impressions > 0 ? (r.amountSpent / r.impressions) * 1000 : 0),
    },
    clicks: {
      id: "clicks",
      label: "Clics",
      category: "Tráfico",
      align: "right",
      renderCell: (r) => <span className=" text-slate-700">{formatNumber(r.clicks || 0)}</span>,
      getSortValue: (r) => r.clicks || 0,
    },
    cpc: {
      id: "cpc",
      label: "CPC",
      category: "Costos",
      align: "right",
      renderCell: (r) => (
        <span className=" text-slate-700">
          {formatCurrency(r.clicks && r.clicks > 0 ? r.amountSpent / r.clicks : 0)}
        </span>
      ),
      getSortValue: (r) => (r.clicks && r.clicks > 0 ? r.amountSpent / r.clicks : 0),
    },
    ctr: {
      id: "ctr",
      label: "CTR",
      category: "Rendimiento",
      align: "right",
      renderCell: (r) => (
        <span className=" text-slate-700">
          {r.impressions > 0 ? `${((r.clicks / r.impressions) * 100).toFixed(2)}%` : "0.00%"}
        </span>
      ),
      getSortValue: (r) => (r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0),
    },
    conversations: {
      id: "conversations",
      label: "Conversaciones",
      shortLabel: "Conversaciones",
      category: "Mensajes",
      align: "right",
      renderCell: (r) => <span className=" text-slate-900">{formatNumber(r.messagingConversationsStarted || 0)}</span>,
      getSortValue: (r) => r.messagingConversationsStarted || 0,
    },
    costPerLead: {
      id: "costPerLead",
      label: "CP Lead",
      category: "Costos",
      align: "right",
      renderCell: (r) => {
        const val =
          r.leads > 0
            ? r.amountSpent / r.leads
            : r.messagingConversationsStarted > 0
            ? r.amountSpent / r.messagingConversationsStarted
            : r.costPerResult;
        return <span className=" text-emerald-700">{formatCurrency(val)}</span>;
      },
      getSortValue: (r) =>
        r.leads > 0
          ? r.amountSpent / r.leads
          : r.messagingConversationsStarted > 0
          ? r.amountSpent / r.messagingConversationsStarted
          : r.costPerResult,
    },
    conversions: {
      id: "conversions",
      label: "Conversiones",
      category: "Resultados",
      align: "right",
      renderCell: (r) => (
        <span className=" text-slate-900 font-semibold">
          {formatNumber(r.purchases > 0 ? r.purchases : r.leads > 0 ? r.leads : r.primaryMetricValue)}
        </span>
      ),
      getSortValue: (r) =>
        r.purchases > 0 ? r.purchases : r.leads > 0 ? r.leads : r.primaryMetricValue,
    },
    costPerConversion: {
      id: "costPerConversion",
      label: "CP Conversión",
      category: "Costos",
      align: "right",
      renderCell: (r) => (
        <span className=" text-emerald-700 font-semibold">
          {formatCurrency(r.purchases > 0 ? r.amountSpent / r.purchases : r.costPerResult)}
        </span>
      ),
      getSortValue: (r) => (r.purchases > 0 ? r.amountSpent / r.purchases : r.costPerResult),
    },
    purchaseValue: {
      id: "purchaseValue",
      label: "Monto Conversión",
      category: "Ingresos",
      align: "right",
      renderCell: (r) => (
        <span className=" text-emerald-800 font-semibold">
          {formatCurrency(r.purchaseValue || 0)}
        </span>
      ),
      getSortValue: (r) => r.purchaseValue || 0,
    },
    roas: {
      id: "roas",
      label: "ROAS",
      category: "Retorno",
      align: "right",
      renderCell: (r) => {
        const val =
          r.roas !== undefined
            ? r.roas
            : r.purchaseValue && r.amountSpent > 0
            ? r.purchaseValue / r.amountSpent
            : undefined;
        return (
          <span className=" font-bold text-emerald-600">
            {val !== undefined ? `${val.toFixed(2)}x` : "-"}
          </span>
        );
      },
      getSortValue: (r) =>
        r.roas !== undefined
          ? r.roas
          : r.purchaseValue && r.amountSpent > 0
          ? r.purchaseValue / r.amountSpent
          : 0,
    },
    followsOrLikes: {
      id: "followsOrLikes",
      label: "Follows / Likes",
      category: "Social",
      align: "right",
      renderCell: (r) => (
        <span className=" font-medium text-cyan-800">
          {formatNumber(r.followsOrLikes || 0)}
        </span>
      ),
      getSortValue: (r) => r.followsOrLikes || 0,
    },
    hookRate: {
      id: "hookRate",
      label: "Hook Rate (3s)",
      category: "Video",
      align: "right",
      renderCell: (r) => <span className=" text-slate-700">{(r.hookRate || 0).toFixed(1)}%</span>,
      getSortValue: (r) => r.hookRate || 0,
    },
    retentionRate: {
      id: "retentionRate",
      label: "Retención (100%)",
      category: "Video",
      align: "right",
      renderCell: (r) => (
        <span className=" text-slate-700">
          {"retentionRate" in r && r.retentionRate !== undefined ? `${r.retentionRate.toFixed(1)}%` : "-"}
        </span>
      ),
      getSortValue: (r) => ("retentionRate" in r ? r.retentionRate || 0 : 0),
    },
  };

  const handleToggleTableColumnInModal = (id: TableColumnKey) => {
    setTempTableColSelection((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least 1 column
        return prev.filter((col) => col !== id);
      }
      return [...prev, id];
    });
  };

  const handleSaveTableColumns = () => {
    if (tempTableColSelection.length > 0) {
      setSelectedTableColumns(tempTableColSelection);
      try {
        localStorage.setItem(`nexops_table_cols_${client.id}`, JSON.stringify(tempTableColSelection));
      } catch {
        // ignore
      }
      setIsTableColModalOpen(false);
    }
  };

  const handleSelectAllTableColumns = () => {
    setTempTableColSelection(Object.keys(tableColumnDefinitions) as TableColumnKey[]);
  };

  const handleResetTableColumns = () => {
    setTempTableColSelection(DEFAULT_TABLE_COLUMNS);
  };

  // 2. Multi-metric chart selector state (up to 3 metrics, defaults: amountSpent & primaryMetricValue)
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([
    "amountSpent",
    "primaryMetricValue",
  ]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 3. Active table tab (creatives vs campaigns)
  const [activeTabTable, setActiveTabTable] = useState<"creatives" | "campaigns">("creatives");

  // 4. Sorting states for tables
  const [creativeSort, setCreativeSort] = useState<{
    field: CreativeSortField;
    direction: SortDirection;
  }>({
    field: "amountSpent",
    direction: "desc",
  });

  const [campaignSort, setCampaignSort] = useState<{
    field: CampaignSortField;
    direction: SortDirection;
  }>({
    field: "amountSpent",
    direction: "desc",
  });

  // Close multi-select dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter rows according to drill-down selection
  const filteredRows = useMemo(() => {
    if (!selectedFilter) return rows;
    if (selectedFilter.type === "campaign") {
      return rows.filter((r) => r.campaignName === selectedFilter.name);
    }
    if (selectedFilter.type === "creative") {
      return rows.filter((r) => (r.creativeName || r.adName) === selectedFilter.name);
    }
    return rows;
  }, [rows, selectedFilter]);

  // Aggregate metrics and data based on filtered rows
  const metrics: AggregatedMetrics = calculateAggregatedMetrics(filteredRows, objective);
  const dailyData = aggregateByDay(filteredRows, objective);

  // Bottom tables are aggregated across all rows
  const rawCreatives = useMemo(() => aggregateByCreative(rows, objective), [rows, objective]);
  const rawCampaigns = useMemo(() => aggregateByCampaign(rows, objective), [rows, objective]);

  // Sorted Creatives Table Data
  const sortedCreatives = useMemo(() => {
    return [...rawCreatives].sort((a, b) => {
      if (creativeSort.field === "creativeName") {
        const nameA = a.creativeName || "";
        const nameB = b.creativeName || "";
        return creativeSort.direction === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      const colDef = tableColumnDefinitions[creativeSort.field as TableColumnKey];
      let valA = colDef ? colDef.getSortValue(a) : (a as any)[creativeSort.field] ?? 0;
      let valB = colDef ? colDef.getSortValue(b) : (b as any)[creativeSort.field] ?? 0;

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === "string") {
        return creativeSort.direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return creativeSort.direction === "asc" ? valA - valB : valB - valA;
    });
  }, [rawCreatives, creativeSort]);

  // Sorted Campaigns Table Data
  const sortedCampaigns = useMemo(() => {
    return [...rawCampaigns].sort((a, b) => {
      if (campaignSort.field === "campaignName") {
        const nameA = a.campaignName || "";
        const nameB = b.campaignName || "";
        return campaignSort.direction === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      const colDef = tableColumnDefinitions[campaignSort.field as TableColumnKey];
      let valA = colDef ? colDef.getSortValue(a) : (a as any)[campaignSort.field] ?? 0;
      let valB = colDef ? colDef.getSortValue(b) : (b as any)[campaignSort.field] ?? 0;

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === "string") {
        return campaignSort.direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return campaignSort.direction === "asc" ? valA - valB : valB - valA;
    });
  }, [rawCampaigns, campaignSort]);

  const handleSortCreatives = (field: CreativeSortField) => {
    setCreativeSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleSortCampaigns = (field: CampaignSortField) => {
    setCampaignSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const getObjectiveIcon = () => {
    switch (objective) {
      case "LEADS":
        return <Users className="w-4 h-4 text-slate-400" />;
      case "COMPRAS":
        return <ShoppingBag className="w-4 h-4 text-slate-400" />;
      case "CONVERSACIONES":
      default:
        return <MessageSquare className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleToggleFilter = (type: "campaign" | "creative", name: string) => {
    if (selectedFilter && selectedFilter.type === type && selectedFilter.name === name) {
      setSelectedFilter(null);
    } else {
      setSelectedFilter({ type, name });
    }
  };

  const handleToggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // Keep at least 1 active metric
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= 3) {
        // If already 3 chosen, replace the first one
        return [...prev.slice(1), key];
      }
      return [...prev, key];
    });
  };

  const handleResetMetrics = () => {
    setSelectedMetrics(["amountSpent", "primaryMetricValue"]);
  };

  // Full Catalog of KPI Indicators
  const kpiDefinitions: Record<
    KpiId,
    {
      id: KpiId;
      label: string;
      icon: React.ReactNode;
      getValue: (m: AggregatedMetrics) => string;
      category: string;
      description: string;
    }
  > = {
    amountSpent: {
      id: "amountSpent",
      label: "Inversión",
      icon: <DollarSign className="w-3.5 h-3.5" />,
      getValue: (m) => formatCurrency(m.amountSpent),
      category: "Inversión",
      description: "Gasto monetario total",
    },
    impressions: {
      id: "impressions",
      label: "Impresiones",
      icon: <Eye className="w-3.5 h-3.5" />,
      getValue: (m) => formatNumber(m.impressions),
      category: "Alcance",
      description: "Visualizaciones totales",
    },
    cpm: {
      id: "cpm",
      label: "CPM",
      icon: <Layers className="w-3.5 h-3.5" />,
      getValue: (m) =>
        formatCurrency(m.impressions > 0 ? (m.amountSpent / m.impressions) * 1000 : 0),
      category: "Costos",
      description: "Costo por mil impresiones",
    },
    clicks: {
      id: "clicks",
      label: "Clics",
      icon: <MousePointerClick className="w-3.5 h-3.5" />,
      getValue: (m) => formatNumber(m.clicks),
      category: "Tráfico",
      description: "Clics en los anuncios",
    },
    cpc: {
      id: "cpc",
      label: "CPC",
      icon: <Coins className="w-3.5 h-3.5" />,
      getValue: (m) => formatCurrency(m.clicks > 0 ? m.amountSpent / m.clicks : 0),
      category: "Costos",
      description: "Costo promedio por clic",
    },
    ctr: {
      id: "ctr",
      label: "CTR",
      icon: <Percent className="w-3.5 h-3.5" />,
      getValue: (m) => `${m.ctr.toFixed(2)}%`,
      category: "Rendimiento",
      description: "Tasa de clics por impresión",
    },
    conversations: {
      id: "conversations",
      label: "Conversaciones iniciadas",
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      getValue: (m) => formatNumber(m.messagingConversationsStarted),
      category: "Mensajes",
      description: "Conversaciones de mensajería",
    },
    costPerLead: {
      id: "costPerLead",
      label: "Costo por resultado",
      icon: <Users className="w-3.5 h-3.5" />,
      getValue: (m) =>
        formatCurrency(
          m.leads > 0
            ? m.amountSpent / m.leads
            : m.messagingConversationsStarted > 0
            ? m.amountSpent / m.messagingConversationsStarted
            : m.costPerResult
        ),
      category: "Costos",
      description: "Costo por lead / conversación",
    },
    conversions: {
      id: "conversions",
      label: "Conversiones",
      icon: <ShoppingBag className="w-3.5 h-3.5" />,
      getValue: (m) =>
        formatNumber(
          m.purchases > 0
            ? m.purchases
            : m.leads > 0
            ? m.leads
            : m.primaryMetricValue
        ),
      category: "Resultados",
      description: "Conversiones / compras totales",
    },
    costPerConversion: {
      id: "costPerConversion",
      label: "CPconversion",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      getValue: (m) =>
        formatCurrency(
          m.purchases > 0
            ? m.amountSpent / m.purchases
            : m.costPerResult
        ),
      category: "Costos",
      description: "Costo por conversión",
    },
    purchaseValue: {
      id: "purchaseValue",
      label: "Monto conversion",
      icon: <DollarSign className="w-3.5 h-3.5" />,
      getValue: (m) => formatCurrency(m.purchaseValue || 0),
      category: "Ingresos",
      description: "Valor de compras / conversiones",
    },
    followsOrLikes: {
      id: "followsOrLikes",
      label: "Follows / Likes",
      icon: <ThumbsUp className="w-3.5 h-3.5" />,
      getValue: (m) => formatNumber(m.followsOrLikes || 0),
      category: "Social",
      description: "Seguidores o Me Gusta",
    },
    roas: {
      id: "roas",
      label: "ROAS",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      getValue: (m) =>
        m.roas !== undefined
          ? `${m.roas.toFixed(2)}x`
          : m.amountSpent > 0 && m.purchaseValue
          ? `${(m.purchaseValue / m.amountSpent).toFixed(2)}x`
          : "0.00x",
      category: "Retorno",
      description: "Retorno de inversión publicitaria",
    },
  };

  const handleToggleKpiInModal = (id: KpiId) => {
    setTempKpiSelection((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 8) {
        // If already 8, replace the first or show feedback
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const handleSaveKpiSelection = () => {
    if (tempKpiSelection.length === 8) {
      setSelectedKpis(tempKpiSelection);
      try {
        localStorage.setItem(`nexops_kpis_${client.id}`, JSON.stringify(tempKpiSelection));
      } catch {
        // ignore
      }
      setIsKpiModalOpen(false);
    }
  };

  const handleResetKpiSelection = () => {
    setTempKpiSelection(DEFAULT_SELECTED_KPIS);
  };

  // Metric options configuration
  const metricOptions: {
    key: MetricKey;
    label: string;
    description: string;
    unit: "$" | "count" | "%";
    color: string;
    gradientId: string;
    yAxisId: "left" | "right";
  }[] = [
    {
      key: "amountSpent",
      label: "Inversión ($)",
      description: "Gasto monetario total diario",
      unit: "$",
      color: "#64748b",
      gradientId: "spendGradient",
      yAxisId: "left",
    },
    {
      key: "primaryMetricValue",
      label: primaryMetricLabel,
      description: `Volumen de ${primaryMetricLabel.toLowerCase()}`,
      unit: "count",
      color: "#4330a6",
      gradientId: "primaryGradient",
      yAxisId: "right",
    },
    {
      key: "costPerResult",
      label: costPerResultLabel,
      description: "Costo unitario por resultado obtenido",
      unit: "$",
      color: "#10b981",
      gradientId: "cpaGradient",
      yAxisId: "left",
    },
    {
      key: "followsOrLikes",
      label: "Follows / Likes",
      description: "Seguidores o Me Gusta generados",
      unit: "count",
      color: "#06b6d4",
      gradientId: "followsGradient",
      yAxisId: "right",
    },
    {
      key: "clicks",
      label: "Clics",
      description: "Total de clics en los anuncios",
      unit: "count",
      color: "#7c5bff",
      gradientId: "clicksGradient",
      yAxisId: "right",
    },
    {
      key: "impressions",
      label: "Impresiones",
      description: "Visualizaciones totales de anuncios",
      unit: "count",
      color: "#0ea5e9",
      gradientId: "impressionsGradient",
      yAxisId: "right",
    },
    {
      key: "cpc",
      label: "CPC ($)",
      description: "Costo promedio por clic",
      unit: "$",
      color: "#f59e0b",
      gradientId: "cpcGradient",
      yAxisId: "left",
    },
    {
      key: "ctr",
      label: "CTR (%)",
      description: "Porcentaje de clics sobre impresiones",
      unit: "%",
      color: "#ec4899",
      gradientId: "ctrGradient",
      yAxisId: "right",
    },
    {
      key: "hookRate",
      label: "Hook Rate (%)",
      description: "Reproducciones de video de al menos 3s",
      unit: "%",
      color: "#8b5cf6",
      gradientId: "hookGradient",
      yAxisId: "right",
    },
  ];

  if (rows.length === 0) {
    const pendingKpis = [
      { label: "Inversión", icon: DollarSign, accent: "bg-violet-50 text-violet-700" },
      { label: primaryMetricLabel, icon: MessageSquare, accent: "bg-sky-50 text-sky-700" },
      { label: costPerResultLabel, icon: TrendingUp, accent: "bg-amber-50 text-amber-700" },
      { label: "Alcance", icon: Users, accent: "bg-emerald-50 text-emerald-700" },
    ];
    const emptyTitle = hasSourceData
      ? `Sin actividad para ${client.name} en este período`
      : `Dashboard preparado para ${client.name}`;
    const emptyDetail = hasSourceData
      ? "La fuente está conectada, pero no devolvió registros para el período elegido. Probá seleccionar Todo para ampliar la consulta."
      : "La estructura ya está activa. Los valores se completan automáticamente cuando quede conectada la fuente de Meta Ads.";
    const sourceStatus = hasSourceData ? "Conectada" : "Meta Ads";
    const updateStatus = hasSourceData ? "Sin registros en el período" : "Pendiente";

    return (
      <div id="client-dashboard" className="animate-fadeIn space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-violet-700 shadow-xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">{emptyTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {emptyDetail}
              </p>
            </div>
          </div>
          <span className="w-fit shrink-0 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700">
            {hasSourceData ? "Sin datos en el período" : "Fuente pendiente"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {pendingKpis.map(({ label, icon: Icon, accent }) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-5 text-2xl font-bold tracking-tight text-slate-400">—</p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">Esperando datos de la cuenta</p>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Evolución de rendimiento</h3>
                <p className="mt-1 text-xs text-slate-500">Inversión y resultados por día</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{dateRangeLabel}</span>
            </div>
            <div className="relative mt-5 h-56 overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50/70">
              <div className="absolute inset-x-4 bottom-8 top-5 flex flex-col justify-between">
                {[0, 1, 2, 3].map((line) => <span key={line} className="h-px bg-slate-200" />)}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center shadow-xs">
                  <TrendingUp className="mx-auto h-5 w-5 text-violet-500" />
                  <p className="mt-2 text-xs font-bold text-slate-700">El gráfico aparecerá con la primera actualización</p>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <h3 className="text-sm font-bold text-slate-950">Estado de la cuenta</h3>
            <div className="mt-4 space-y-3">
              {[
                ["Cuenta publicitaria", client.accountName || "Sin vincular"],
                ["Fuente de datos", sourceStatus],
                ["Actualización", updateStatus],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-xs last:border-0 last:pb-0">
                  <span className="text-slate-500">{label}</span>
                  <span className="max-w-[58%] truncate text-right font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[
            { title: "Campañas", detail: "Rendimiento, inversión y resultados por campaña", icon: Layers },
            { title: "Creatividades", detail: "Piezas con mejor desempeño y oportunidades", icon: Film },
          ].map(({ title, detail, icon: Icon }) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">{title}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-medium text-slate-500">
                Disponible al conectar la fuente
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // Conversion rate from clicks to star metric
  const clickToResultRate =
    metrics.clicks > 0
      ? ((metrics.primaryMetricValue / metrics.clicks) * 100).toFixed(1)
      : "0.0";

  // Check which axes are needed in chart
  const activeConfigs = metricOptions.filter((opt) => selectedMetrics.includes(opt.key));
  const hasLeftAxis = activeConfigs.some((c) => c.yAxisId === "left");
  const hasRightAxis = activeConfigs.some((c) => c.yAxisId === "right");

  // Helper render sort icon for table headers
  const renderSortIcon = (currentField: string, targetField: string, direction: SortDirection) => {
    if (currentField !== targetField) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover/th:text-slate-500 transition-colors" />;
    }
    return direction === "desc" ? (
      <ArrowDown className="w-3.5 h-3.5 text-violet-600 font-bold" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-violet-600 font-bold" />
    );
  };

  return (
    <div
      id="client-dashboard"
      className="p-4 space-y-4 sm:p-5 animate-fadeIn"
    >
      {/* ACTIVE DRILL-DOWN FILTER BANNER */}
      {selectedFilter && (
        <div className="bg-violet-50/90 border border-violet-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 text-violet-700 rounded-lg shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-violet-900 font-semibold">
                  Filtrando vista por {selectedFilter.type === "campaign" ? "Campaña" : "Creativo"}:
                </span>
                <span className="font-bold text-violet-950  bg-white px-2 py-0.5 rounded border border-violet-200">
                  {selectedFilter.name}
                </span>
              </div>
              <p className="text-violet-700/80 text-[11px]">
                Mostrando indicadores y evolución exclusiva de esta selección ({filteredRows.length} registros).
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedFilter(null)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-violet-200 text-violet-700 font-semibold hover:bg-violet-100 transition-colors shrink-0 text-xs cursor-pointer shadow-2xs self-start sm:self-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>Ver Cuenta Completa</span>
          </button>
        </div>
      )}

      {/* 1. TOP 8 KPI METRICS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#596273]">
              Indicadores Principales
            </span>
            <span className="text-[11px]  font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/70">
              {selectedKpis.length}/8 activos
            </span>
          </div>
          <button
            id="btn-customize-kpis"
            onClick={() => {
              setTempKpiSelection([...selectedKpis]);
              setIsKpiModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-violet-600 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Personalizar 8 Indicadores</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {selectedKpis.map((kpiId) => {
            const def = kpiDefinitions[kpiId];
            if (!def) return null;
            return (
              <div
                key={kpiId}
                className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between h-[96px] sm:h-[104px] group hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between text-slate-400 gap-2">
                  <span
                    className="text-xs font-medium text-[#6b7280] truncate"
                    title={def.label}
                  >
                    {def.label}
                  </span>
                  <span className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                    {def.icon}
                  </span>
                </div>
                <div
                  className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight truncate"
                  title={def.getValue(metrics)}
                >
                  {def.getValue(metrics)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. FULL-WIDTH DYNAMIC TREND CHART WITH MULTI-SELECT DROPDOWN (UP TO 3 METRICS) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Header with Title and Multi-Select Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Evolución Diaria
              </h3>
              <span className="text-[11px] font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full  border border-violet-100">
                {selectedMetrics.length}/3 seleccionados
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comportamiento diario consolidado durante {dateRangeLabel}
              {selectedFilter && ` (${selectedFilter.name})`}
            </p>
          </div>

          {/* Metric Selector Controls: Multi-select Dropdown & Active Chips */}
          <div className="flex items-center gap-2 flex-wrap relative" ref={dropdownRef}>
            {/* Multi-Select Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                  isDropdownOpen
                    ? "bg-slate-900 text-white border-slate-900 ring-2 ring-violet-500/20"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                }`}
                aria-expanded={isDropdownOpen}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Seleccionar Indicadores</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isDropdownOpen ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {selectedMetrics.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180 text-white" : "text-slate-400"
                  }`}
                />
              </button>

              {/* Floating Multi-Select Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 space-y-1.5 animate-fadeIn">
                  <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Métricas para el Gráfico
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Elige hasta 3 indicadores simultáneos
                      </span>
                    </div>
                    <button
                      onClick={handleResetMetrics}
                      className="text-[10px] text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1 cursor-pointer"
                      title="Restablecer a Inversión y Conversaciones"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Defecto</span>
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-0.5 py-1">
                    {metricOptions.map((opt) => {
                      const isSelected = selectedMetrics.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleToggleMetric(opt.key)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? "bg-slate-50 font-medium text-slate-900"
                              : "hover:bg-slate-50/70 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: opt.color }}
                            />
                            <div className="truncate">
                              <span className="font-semibold block truncate text-slate-900">
                                {opt.label}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {opt.description}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                              isSelected
                                ? "bg-slate-900 border-slate-900 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Active Metrics Chips for quick viewing and removal */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeConfigs.map((opt) => (
                <span
                  key={opt.key}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span>{opt.label}</span>
                  {selectedMetrics.length > 1 && (
                    <button
                      onClick={() => handleToggleMetric(opt.key)}
                      className="hover:bg-slate-200 rounded p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title={`Quitar ${opt.label}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Area Chart */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4330a6" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#4330a6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="cpaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c5bff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c5bff" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="impressionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="cpcGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="hookGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="followsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              {hasLeftAxis && (
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                />
              )}
              {hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.15)",
                }}
                itemStyle={{ color: "#fff" }}
                formatter={(val: any, name: any) => {
                  const opt = metricOptions.find((o) => o.label === name);
                  const num = Number(val);
                  if (opt?.unit === "$") {
                    return [`$${num.toFixed(2)}`, name];
                  }
                  if (opt?.unit === "%") {
                    return [`${num.toFixed(2)}%`, name];
                  }
                  return [num.toLocaleString("es-AR"), name];
                }}
                labelFormatter={(lbl) => `Fecha: ${lbl}`}
              />
              {activeConfigs.map((opt) => (
                <Area
                  key={opt.key}
                  yAxisId={opt.yAxisId}
                  type="monotone"
                  dataKey={opt.key}
                  name={opt.label}
                  stroke={opt.color}
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill={`url(#${opt.gradientId})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. SORTABLE PERFORMANCE TABLES (CLICK HEADERS TO SORT, ROWS TO FILTER) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
        {/* Table Selector Header & Column Customization Trigger */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTabTable("creatives")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTabTable === "creatives"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Ranking de Creativos ({sortedCreatives.length})
            </button>
            <button
              onClick={() => setActiveTabTable("campaigns")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTabTable === "campaigns"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Desglose por Campaña ({sortedCampaigns.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 hidden sm:flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
              <span>Clic en encabezado para ordenar | Clic en fila para filtrar</span>
            </span>

            {/* Customize Table Columns Button */}
            <button
              type="button"
              onClick={() => {
                setTempTableColSelection(selectedTableColumns);
                setIsTableColModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50/80 hover:bg-violet-100/90 border border-violet-200/80 rounded-lg transition-all shadow-2xs cursor-pointer"
              title="Personalizar columnas e indicadores visibles de la tabla"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Personalizar Columnas ({selectedTableColumns.length})</span>
            </button>
          </div>
        </div>

        {/* Creatives Table with Dynamic Selected Columns */}
        {activeTabTable === "creatives" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th
                    onClick={() => handleSortCreatives("creativeName")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors group/th select-none sticky left-0 bg-slate-50/95 z-10 shadow-xs"
                    title="Ordenar por Anuncio / Creativo"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Anuncio / Creativo</span>
                      {renderSortIcon(creativeSort.field, "creativeName", creativeSort.direction)}
                    </div>
                  </th>

                  {selectedTableColumns.map((colKey) => {
                    const colDef = tableColumnDefinitions[colKey];
                    if (!colDef) return null;
                    return (
                      <th
                        key={colKey}
                        onClick={() => handleSortCreatives(colKey)}
                        className={`py-3 px-4 ${colDef.align === "left" ? "text-left" : "text-right"} cursor-pointer hover:bg-slate-100/80 transition-colors group/th select-none`}
                        title={`Ordenar por ${colDef.label}`}
                      >
                        <div className={`flex items-center ${colDef.align === "left" ? "justify-start" : "justify-end"} gap-1.5`}>
                          <span>{colDef.shortLabel || colDef.label}</span>
                          {renderSortIcon(creativeSort.field, colKey, creativeSort.direction)}
                        </div>
                      </th>
                    );
                  })}

                  <th className="py-3 px-4 text-center select-none text-slate-400 font-normal">
                    Filtro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedCreatives.map((creative, index) => {
                  const isSelected =
                    selectedFilter?.type === "creative" &&
                    selectedFilter.name === creative.creativeName;

                  return (
                    <tr
                      key={index}
                      onClick={() => handleToggleFilter("creative", creative.creativeName)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? "bg-violet-50/90 font-medium ring-1 ring-inset ring-violet-200"
                          : "hover:bg-slate-50/70"
                      }`}
                      title={
                        isSelected
                          ? "Clic para quitar filtro"
                          : `Clic para filtrar indicadores por "${creative.creativeName}"`
                      }
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50/70 z-10">
                        <div className="flex items-center gap-2.5 max-w-[240px] sm:max-w-[300px]">
                          {creative.creativeFacebookUrl ? (
                            <a
                              href={creative.creativeFacebookUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="relative group/thumb w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center hover:ring-2 hover:ring-violet-500 hover:border-violet-500 transition-all cursor-pointer shadow-2xs"
                              title="Abrir enlace del anuncio en Facebook"
                            >
                              {creative.thumbnailUrl && creative.thumbnailUrl.trim().length > 0 ? (
                                <img
                                  src={creative.thumbnailUrl}
                                  alt={creative.creativeName}
                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <Film className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                <ExternalLink className="w-3 h-3 text-white drop-shadow-md" />
                              </div>
                            </a>
                          ) : (
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                              {creative.thumbnailUrl && creative.thumbnailUrl.trim().length > 0 ? (
                                <img
                                  src={creative.thumbnailUrl}
                                  alt={creative.creativeName}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <Film className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-semibold block truncate ${
                                  isSelected ? "text-violet-950" : "text-slate-900 group-hover:text-violet-600"
                                }`}
                                title={creative.creativeName}
                              >
                                {creative.creativeName}
                              </span>
                              {creative.creativeFacebookUrl && (
                                <a
                                  href={creative.creativeFacebookUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-400 hover:text-violet-600 transition-colors shrink-0"
                                  title="Abrir enlace en Facebook"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {selectedTableColumns.map((colKey) => {
                        const colDef = tableColumnDefinitions[colKey];
                        if (!colDef) return null;
                        return (
                          <td
                            key={colKey}
                            className={`py-2.5 px-4 ${colDef.align === "left" ? "text-left" : "text-right"}`}
                          >
                            {colDef.renderCell(creative)}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-4 text-center">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-white border border-violet-300 px-2 py-0.5 rounded-full shadow-2xs">
                            <Check className="w-2.5 h-2.5" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 group-hover:text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                            Filtrar ↵
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sortedCreatives.length === 0 && (
                  <tr>
                    <td
                      colSpan={selectedTableColumns.length + 2}
                      className="py-8 text-center text-slate-400"
                    >
                      No hay creativos registrados para este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Campaigns Table with Dynamic Selected Columns */}
        {activeTabTable === "campaigns" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th
                    onClick={() => handleSortCampaigns("campaignName")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors group/th select-none sticky left-0 bg-slate-50/95 z-10 shadow-xs"
                    title="Ordenar por Campaña"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Campaña</span>
                      {renderSortIcon(campaignSort.field, "campaignName", campaignSort.direction)}
                    </div>
                  </th>

                  {selectedTableColumns.map((colKey) => {
                    const colDef = tableColumnDefinitions[colKey];
                    if (!colDef) return null;
                    return (
                      <th
                        key={colKey}
                        onClick={() => handleSortCampaigns(colKey)}
                        className={`py-3 px-4 ${colDef.align === "left" ? "text-left" : "text-right"} cursor-pointer hover:bg-slate-100/80 transition-colors group/th select-none`}
                        title={`Ordenar por ${colDef.label}`}
                      >
                        <div className={`flex items-center ${colDef.align === "left" ? "justify-start" : "justify-end"} gap-1.5`}>
                          <span>{colDef.shortLabel || colDef.label}</span>
                          {renderSortIcon(campaignSort.field, colKey, campaignSort.direction)}
                        </div>
                      </th>
                    );
                  })}

                  <th className="py-3 px-4 text-center select-none text-slate-400 font-normal">
                    Filtro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedCampaigns.map((camp, index) => {
                  const isSelected =
                    selectedFilter?.type === "campaign" &&
                    selectedFilter.name === camp.campaignName;

                  return (
                    <tr
                      key={index}
                      onClick={() => handleToggleFilter("campaign", camp.campaignName)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? "bg-violet-50/90 font-medium ring-1 ring-inset ring-violet-200"
                          : "hover:bg-slate-50/70"
                      }`}
                      title={
                        isSelected
                          ? "Clic para quitar filtro"
                          : `Clic para filtrar indicadores por "${camp.campaignName}"`
                      }
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50/70 z-10">
                        <div className="flex items-center gap-2 max-w-[240px] sm:max-w-[300px]">
                          <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-violet-600" : "text-slate-400 group-hover:text-violet-500"}`} />
                          <span className={`truncate ${isSelected ? "text-violet-950" : "group-hover:text-violet-600"}`} title={camp.campaignName}>
                            {camp.campaignName}
                          </span>
                        </div>
                      </td>

                      {selectedTableColumns.map((colKey) => {
                        const colDef = tableColumnDefinitions[colKey];
                        if (!colDef) return null;
                        return (
                          <td
                            key={colKey}
                            className={`py-2.5 px-4 ${colDef.align === "left" ? "text-left" : "text-right"}`}
                          >
                            {colDef.renderCell(camp)}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-4 text-center">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-white border border-violet-300 px-2 py-0.5 rounded-full shadow-2xs">
                            <Check className="w-2.5 h-2.5" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 group-hover:text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                            Filtrar ↵
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sortedCampaigns.length === 0 && (
                  <tr>
                    <td
                      colSpan={selectedTableColumns.length + 2}
                      className="py-8 text-center text-slate-400"
                    >
                      No hay campañas registradas para este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KPI CUSTOMIZATION MODAL */}
      {isKpiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-violet-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Personalizar Indicadores de la Cuenta
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Selecciona exactamente 8 indicadores clave para visualizar en el panel de {client.name}.
                </p>
              </div>
              <button
                onClick={() => setIsKpiModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Metrics Catalog */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Estado de selección:</span>
                  <span
                    className={` font-bold px-2 py-0.5 rounded-full ${
                      tempKpiSelection.length === 8
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {tempKpiSelection.length} / 8 seleccionados
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetKpiSelection}
                  className="text-violet-600 hover:text-violet-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Valores sugeridos</span>
                </button>
              </div>

              {tempKpiSelection.length !== 8 && (
                <div className="text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200 px-3 py-2 rounded-lg">
                  💡 Por favor selecciona exactamente 8 indicadores para guardar la configuración.
                </div>
              )}

              {/* Grid of All Available Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(kpiDefinitions) as KpiId[]).map((id) => {
                  const def = kpiDefinitions[id];
                  const isSelected = tempKpiSelection.includes(id);
                  const selectionIndex = tempKpiSelection.indexOf(id);

                  return (
                    <div
                      key={id}
                      onClick={() => handleToggleKpiInModal(id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-violet-50/70 border-violet-300 shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-violet-600 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {def.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {def.label}
                            </span>
                            <span className="text-[10px] text-slate-400 ">
                              ({def.category})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate">
                            Valor actual: <strong className="text-slate-800 ">{def.getValue(metrics)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center  font-bold text-[10px] shadow-2xs">
                            {selectionIndex + 1}
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Se guardará la configuración para esta cuenta.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsKpiModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveKpiSelection}
                  disabled={tempKpiSelection.length !== 8}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    tempKpiSelection.length === 8
                      ? "bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar 8 Indicadores</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE COLUMNS CUSTOMIZATION MODAL */}
      {isTableColModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-violet-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Personalizar Columnas de Tablas
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Selecciona qué indicadores deseas ver en las tablas de Creativos y Campañas.
                </p>
              </div>
              <button
                onClick={() => setIsTableColModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Columnas activas:</span>
                  <span className=" font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                    {tempTableColSelection.length} seleccionadas
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAllTableColumns}
                    className="text-violet-600 hover:text-violet-800 font-semibold inline-flex items-center gap-1 cursor-pointer text-xs"
                  >
                    <span>Seleccionar todas</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleResetTableColumns}
                    className="text-slate-600 hover:text-slate-800 font-semibold inline-flex items-center gap-1 cursor-pointer text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Predeterminadas</span>
                  </button>
                </div>
              </div>

              {/* Grid of All Table Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(tableColumnDefinitions) as TableColumnKey[]).map((key) => {
                  const col = tableColumnDefinitions[key];
                  const isSelected = tempTableColSelection.includes(key);

                  return (
                    <div
                      key={key}
                      onClick={() => handleToggleTableColumnInModal(key)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-violet-50/70 border-violet-300 shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold truncate ${
                              isSelected ? "text-violet-950" : "text-slate-800"
                            }`}
                          >
                            {col.label}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            {col.category}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-md bg-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md border border-slate-300 flex items-center justify-center" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Se recordará tu selección para esta cuenta.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTableColModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTableColumns}
                  disabled={tempTableColSelection.length === 0}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    tempTableColSelection.length > 0
                      ? "bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar ({tempTableColSelection.length}) Columnas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
