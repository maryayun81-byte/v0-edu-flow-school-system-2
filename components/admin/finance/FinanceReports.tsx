"use client";

import { useState, useCallback } from "react";
import type { Payment, TuitionEvent, Student } from "./types";
import { FinanceCore } from "@/lib/ai/FinanceCore";
import {
  BarChart2, TrendingUp, AlertTriangle, Users, ShieldCheck,
  FileDown, FileText, Loader2, Zap, Activity, Target,
  ChevronRight, Eye, RefreshCw, Brain, Calendar, DollarSign
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, RadialBarChart, RadialBar
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props { payments: Payment[]; events: TuitionEvent[]; students: Student[]; }

type ReportId = "balance_sheet" | "revenue" | "cashflow" | "risk" | "transactions";

interface ReportMeta {
  id: ReportId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  color: string;
}

type ReportData = Record<string, any> | null;

// ─── Constants ───────────────────────────────────────────────────────────────
const REPORTS: ReportMeta[] = [
  {
    id: "balance_sheet", label: "Balance Sheet Intelligence", icon: ShieldCheck,
    desc: "Platform financial position — assets vs liabilities, net equity.", badge: "⭐ Premium", color: "indigo"
  },
  {
    id: "revenue", label: "Revenue Performance Report", icon: TrendingUp,
    desc: "Collection efficiency, velocity gradient, cohort analysis.", color: "emerald"
  },
  {
    id: "cashflow", label: "Cashflow Forecast Report", icon: BarChart2,
    desc: "Predictive 30/60/90-day revenue model with stress index.", badge: "⭐ Premium", color: "violet"
  },
  {
    id: "risk", label: "Outstanding Balance Risk Report", icon: AlertTriangle,
    desc: "Concentration analysis — high-risk student clusters.", badge: "⭐ Premium", color: "amber"
  },
  {
    id: "transactions", label: "Multi-Student Transaction Map", icon: Users,
    desc: "Full ledger — event mappings, reference code audit.", color: "cyan"
  },
];

const COLOR_MAP: Record<string, string> = {
  indigo: "#6366f1", emerald: "#10b981", violet: "#8b5cf6", amber: "#f59e0b", cyan: "#06b6d4"
};

// ─── CSV Export Helper ────────────────────────────────────────────────────────
function exportCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function fmt(n: number) { return `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FinanceReports({ payments, events, students }: Props) {
  const [selected, setSelected] = useState<ReportId | null>(null);
  const [reportData, setReportData] = useState<ReportData>(null);
  const [loading, setLoading] = useState(false);
  const [horizon, setHorizon] = useState(30);
  const [detailLevel, setDetailLevel] = useState<"Executive" | "Detailed" | "Raw Data">("Executive");

  const paid = payments.filter(p => p.status === "paid");
  const totalRevenue = paid.reduce((s, p) => s + p.amount, 0);
  const totalExpected = events.reduce((s, e) => s + (e.tuition_fee || 0), 0);
  const outstanding = payments.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0);
  const efficiency = totalExpected > 0 ? totalRevenue / totalExpected : 0;

  async function generateReport(id: ReportId) {
    setSelected(id);
    setLoading(true);
    setReportData(null);
    try {
      let data: ReportData;
      if (id === "balance_sheet") data = await FinanceCore.generateBalanceSheet();
      else if (id === "revenue") data = await FinanceCore.generateRevenueReport();
      else if (id === "cashflow") data = await FinanceCore.generateCashflowForecast(horizon);
      else if (id === "risk") data = await FinanceCore.generateRiskReport();
      else data = buildTransactionMap();
      setReportData(data);
    } finally {
      setLoading(false);
    }
  }

  function buildTransactionMap() {
    return {
      students: students.map(s => {
        const sp = paid.filter(p => p.student_id === s.id);
        return {
          name: s.full_name, admission: s.admission_number,
          total: sp.reduce((sum, p) => sum + p.amount, 0),
          count: sp.length,
          lastDate: sp.length > 0 ? sp.sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0].payment_date : "—"
        };
      }).sort((a, b) => b.total - a.total),
      insight: `Top 3 students account for ${pct(students.slice(0, 3).reduce((s, st) => s + paid.filter(p => p.student_id === st.id).reduce((ss, p) => ss + p.amount, 0), 0) / (totalRevenue || 1))} of total revenue.`
    };
  }

  function handleCSVExport() {
    if (!reportData || !selected) return;
    if (selected === "balance_sheet") {
      exportCSV([
        ["Category", "Item", "Amount (KES)"],
        ["Assets", "Outstanding Receivables", String(reportData.assets.receivables)],
        ["Assets", "Cash Reserves", String(reportData.assets.cashReserves)],
        ["Assets", "Prepaid Tuition", String(reportData.assets.prepaidTuition)],
        ["Liabilities", "Deferred Fees", String(reportData.liabilities.deferredFees)],
        ["Liabilities", "Refund Obligations", String(reportData.liabilities.refundObligations)],
        ["Net", "Net Position", String(reportData.netPosition)],
      ], `Balance_Sheet_${new Date().toISOString().split("T")[0]}.csv`);
    } else if (selected === "revenue") {
      exportCSV([
        ["Metric", "Value"],
        ["Expected Revenue", String(reportData.metrics.expected)],
        ["Collected Revenue", String(reportData.metrics.collected)],
        ["Collection Efficiency", pct(reportData.metrics.efficiency)],
        ["Payment Velocity (daily avg)", String(reportData.metrics.velocity)],
      ], `Revenue_Report_${new Date().toISOString().split("T")[0]}.csv`);
    } else if (selected === "cashflow") {
      exportCSV([
        ["Forecast Horizon", "Projected Inflow (KES)", "Stress Index"],
        [String(reportData.horizon) + " days", String(reportData.projectedInflow), String(reportData.riskProbability)],
      ], `Cashflow_Forecast_${new Date().toISOString().split("T")[0]}.csv`);
    } else if (selected === "risk") {
      exportCSV([
        ["Risk Cluster", "Student Count", "Balance (KES)"],
        ...reportData.riskClusters.map((c: any) => [c.name, String(c.count), String(c.balance)])
      ], `Risk_Report_${new Date().toISOString().split("T")[0]}.csv`);
    } else if (selected === "transactions") {
      exportCSV([
        ["Student", "Admission No.", "Total Paid (KES)", "No. of Payments", "Last Payment"],
        ...reportData.students.map((s: any) => [s.name, s.admission, String(s.total), String(s.count), s.lastDate])
      ], `Transaction_Map_${new Date().toISOString().split("T")[0]}.csv`);
    }
  }

  const selectedMeta = REPORTS.find(r => r.id === selected);
  const accentColor = selectedMeta ? COLOR_MAP[selectedMeta.color] : "#6366f1";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Executive Summary Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Collected", value: fmt(totalRevenue), icon: DollarSign, color: "emerald" },
          { label: "Outstanding Balance", value: fmt(outstanding), icon: AlertTriangle, color: "amber" },
          { label: "Collection Efficiency", value: pct(efficiency), icon: Target, color: "indigo" },
          { label: "Total Transactions", value: String(payments.length), icon: Activity, color: "violet" },
        ].map(card => (
          <div key={card.label} className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-${card.color}-500/10 flex-shrink-0`}>
              <card.icon className={`w-5 h-5 text-${card.color}-500`} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground font-bold uppercase truncate">{card.label}</div>
              <div className="text-lg font-black text-foreground">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Report Selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Brain className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Report Intelligence Engine</h3>
          </div>

          {REPORTS.map(r => {
            const Icon = r.icon;
            const isActive = selected === r.id;
            const color = COLOR_MAP[r.color];
            return (
              <button
                key={r.id}
                onClick={() => generateReport(r.id)}
                disabled={loading && selected === r.id}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 group ${
                  isActive
                    ? "border-[" + color + "]/50 bg-[" + color + "]/5 shadow-lg"
                    : "bg-card/40 border-border/50 hover:border-border hover:bg-card/60"
                }`}
                style={isActive ? { borderColor: color + "50", backgroundColor: color + "0d" } : {}}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                    style={{ backgroundColor: isActive ? color + "20" : undefined }}
                  >
                    <div style={isActive ? { color } : {}}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{r.label}</span>
                      {r.badge && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">{r.badge}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{r.desc}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 transition-transform ${isActive ? "rotate-90 text-indigo-500" : "text-muted-foreground"}`} />
                </div>
              </button>
            );
          })}

          {/* Forecast Horizon Control */}
          {selected === "cashflow" && (
            <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-violet-400 tracking-wider">Forecast Horizon</span>
                <span className="text-violet-400 font-mono font-bold text-sm">{horizon} days</span>
              </div>
              <div className="flex gap-2">
                {[30, 60, 90].map(h => (
                  <button key={h} onClick={() => { setHorizon(h); generateReport("cashflow"); }}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                      horizon === h ? "bg-violet-600/20 border-violet-500 text-violet-300" : "bg-card/50 border-border/50 text-muted-foreground"
                    }`}>{h}d</button>
                ))}
              </div>
            </div>
          )}

          {/* Detail Level */}
          <div className="p-4 bg-card/40 border border-border/50 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Report Detail Level</span>
            <div className="flex gap-2">
              {(["Executive", "Detailed", "Raw Data"] as const).map(l => (
                <button key={l} onClick={() => setDetailLevel(l)}
                  className={`flex-1 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all ${
                    detailLevel === l ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-card/50 border-border/50 text-muted-foreground"
                  }`}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Report Preview */}
        <div className="lg:col-span-2">
          {!selected && !loading && (
            <div className="h-full flex flex-col items-center justify-center py-24 bg-card/30 border border-border/50 rounded-3xl border-dashed">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <Eye className="w-8 h-8 text-indigo-500/50" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Select a Report</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                Choose a report type from the left to generate an AI-synthesized financial intelligence preview.
              </p>
            </div>
          )}

          {loading && (
            <div className="h-full flex flex-col items-center justify-center py-24 bg-card/30 border border-border/50 rounded-3xl">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4 animate-pulse">
                <Brain className="w-8 h-8 text-indigo-500" />
              </div>
              <p className="text-sm font-bold text-foreground">FSC Processing...</p>
              <p className="text-xs text-muted-foreground mt-1">Running intelligence pipeline</p>
              <div className="flex gap-1 mt-4">
                {["Aggregating", "Transforming", "Synthesizing", "Composing"].map((s, i) => (
                  <span key={s} className="text-[9px] px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-bold animate-pulse" style={{ animationDelay: `${i * 150}ms` }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {!loading && reportData && selected === "balance_sheet" && (
            <BalanceSheetPreview data={reportData} onExport={handleCSVExport} />
          )}
          {!loading && reportData && selected === "revenue" && (
            <RevenueReportPreview data={reportData} payments={payments} events={events} onExport={handleCSVExport} />
          )}
          {!loading && reportData && selected === "cashflow" && (
            <CashflowForecastPreview data={reportData} onExport={handleCSVExport} accentColor={accentColor} />
          )}
          {!loading && reportData && selected === "risk" && (
            <RiskReportPreview data={reportData} onExport={handleCSVExport} />
          )}
          {!loading && reportData && selected === "transactions" && (
            <TransactionMapPreview data={reportData} onExport={handleCSVExport} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SUB REPORT PREVIEWS ──────────────────────────────────────────────────────

function ReportShell({ title, badge, insight, insights, onExport, children }: {
  title: string; badge?: string; insight: string; insights?: string[]; onExport: () => void; children: React.ReactNode;
}) {
  const narratives = (insights && insights.length > 0) ? insights : [insight];

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between p-6 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground text-lg">{title}</h3>
            {badge && <span className="text-[9px] font-black px-2 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full">{badge}</span>}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Generated {new Date().toLocaleString()}</p>
        </div>
        <button onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20">
          <FileDown className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="p-6 space-y-6">{children}</div>

      {/* FIPCL Narrative Intelligence Feed */}
      <div className="mx-6 mb-6 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-indigo-500" />
          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">FIPCL Cognitive Intelligence Layer</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">{narratives.length} Insight{narratives.length > 1 ? 's' : ''}</span>
        </div>
        {narratives.map((n, i) => (
          <div key={i} className={`p-4 rounded-2xl flex items-start gap-3 border transition-all ${
            i === 0
              ? 'bg-indigo-500/8 border-indigo-500/25'
              : 'bg-card/30 border-border/30'
          }`}>
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-black ${
              i === 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-muted/30 text-muted-foreground'
            }`}>{i + 1}</div>
            <p className={`text-xs leading-relaxed ${i === 0 ? 'text-indigo-100/90 font-medium' : 'text-muted-foreground'}`}>{n}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────
function BalanceSheetPreview({ data, onExport }: { data: any; onExport: () => void }) {
  const rows = [
    { category: "Assets", label: "Outstanding Receivables", value: data.assets.receivables, signal: "green" },
    { category: "Assets", label: "Cash Reserves", value: data.assets.cashReserves, signal: "green" },
    { category: "Assets", label: "Prepaid Tuition Balances", value: data.assets.prepaidTuition, signal: "green" },
    { category: "Liabilities", label: "Deferred Fee Obligations", value: data.liabilities.deferredFees, signal: "red" },
    { category: "Liabilities", label: "Refund Provisions", value: data.liabilities.refundObligations, signal: "red" },
  ];
  const totalAssets = data.assets.receivables + data.assets.cashReserves + data.assets.prepaidTuition;
  const totalLiabilities = data.liabilities.deferredFees + data.liabilities.refundObligations;
  const chartData = [
    { name: "Assets", value: totalAssets, fill: "#10b981" },
    { name: "Liabilities", value: totalLiabilities, fill: "#f43f5e" },
    { name: "Net Position", value: data.netPosition, fill: "#6366f1" },
  ];

  return (
    <ReportShell title="Balance Sheet Intelligence" badge="⭐" insight={data.insight} insights={data.insights} onExport={onExport}>
      <div className="grid grid-cols-3 gap-3">
        {chartData.map(d => (
          <div key={d.name} className="rounded-2xl border border-border/50 p-4 text-center" style={{ backgroundColor: d.fill + "0d", borderColor: d.fill + "30" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: d.fill }}>{d.name}</div>
            <div className="text-xl font-black text-foreground">{fmt(d.value)}</div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/20">
              <th className="text-left p-3 font-bold text-muted-foreground uppercase tracking-wider">Category</th>
              <th className="text-left p-3 font-bold text-muted-foreground uppercase tracking-wider">Line Item</th>
              <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/30 hover:bg-muted/10 transition-colors">
                <td className="p-3 font-bold" style={{ color: r.signal === "green" ? "#10b981" : "#f43f5e" }}>{r.category}</td>
                <td className="p-3 text-foreground">{r.label}</td>
                <td className="p-3 text-right font-mono font-bold text-foreground">{fmt(r.value)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/20">
              <td colSpan={2} className="p-3 font-black text-foreground uppercase text-[10px] tracking-wider">Net Platform Position</td>
              <td className="p-3 text-right font-black text-indigo-400 font-mono text-base">{fmt(data.netPosition)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}

// ── Revenue Performance ───────────────────────────────────────────────────────
function RevenueReportPreview({ data, payments, events, onExport }: { data: any; payments: Payment[]; events: TuitionEvent[]; onExport: () => void }) {
  const cohortData = data.cohortAnalysis.map((c: any) => ({ ...c, displayRate: +(c.collectionRate * 100).toFixed(0) }));
  const efficiencyPct = +(data.metrics.efficiency * 100).toFixed(1);

  return (
    <ReportShell title="Revenue Performance Report" insight={data.insight} insights={data.insights} onExport={onExport}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Expected Revenue", value: fmt(data.metrics.expected) },
          { label: "Collected Revenue", value: fmt(data.metrics.collected) },
          { label: "Collection Efficiency", value: `${efficiencyPct}%` },
          { label: "Payment Velocity", value: `${data.metrics.velocity}/day` },
        ].map(m => (
          <div key={m.label} className="p-3 bg-card/60 border border-border/50 rounded-xl text-center">
            <div className="text-[9px] font-bold text-muted-foreground uppercase truncate">{m.label}</div>
            <div className="text-base font-black text-foreground mt-1">{m.value}</div>
          </div>
        ))}
      </div>
      {/* Collection Efficiency Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground font-bold uppercase">
          <span>Collection Efficiency Ratio</span><span className="text-emerald-400">{efficiencyPct}%</span>
        </div>
        <div className="h-3 w-full bg-muted/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" style={{ width: `${efficiencyPct}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground italic">Formula: Actual Collected / Expected Revenue × 100</p>
      </div>
      {/* Cohort Analysis Bar Chart */}
      <div>
        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Cohort Payment Behaviour</h4>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohortData} barSize={40}>
              <XAxis dataKey="group" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px" }} formatter={(v: any) => [`${v}%`, "Rate"]} />
              <Bar dataKey="displayRate" radius={[8, 8, 0, 0]}>
                {cohortData.map((c: any, i: number) => (
                  <Cell key={i} fill={["#10b981", "#6366f1", "#f59e0b"][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ReportShell>
  );
}

// ── Cashflow Forecast ─────────────────────────────────────────────────────────
function CashflowForecastPreview({ data, onExport, accentColor }: { data: any; onExport: () => void; accentColor: string }) {
  const forecastData = [
    { name: "Now", value: 0 },
    { name: "T+10", value: data.projectedInflow * 0.3 },
    { name: "T+20", value: data.projectedInflow * 0.65 },
    { name: `T+${data.horizon}d`, value: data.projectedInflow },
  ];
  const stressColor = data.riskProbability > 0.6 ? "#f43f5e" : data.riskProbability > 0.3 ? "#f59e0b" : "#10b981";
  const stressLabel = data.riskProbability > 0.6 ? "Financial Risk Zone" : data.riskProbability > 0.3 ? "Watch Zone" : "Healthy Liquidity";

  return (
    <ReportShell title="Cashflow Intelligence Forecast" badge="⭐" insight={data.insight} insights={data.insights} onExport={onExport}>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl border" style={{ backgroundColor: accentColor + "0d", borderColor: accentColor + "30" }}>
          <div className="text-[10px] font-bold uppercase mb-1" style={{ color: accentColor }}>Projected Inflow ({data.horizon}d)</div>
          <div className="text-2xl font-black text-foreground">{fmt(data.projectedInflow)}</div>
        </div>
        <div className="p-4 rounded-2xl border" style={{ backgroundColor: stressColor + "0d", borderColor: stressColor + "30" }}>
          <div className="text-[10px] font-bold uppercase mb-1" style={{ color: stressColor }}>Cashflow Stress</div>
          <div className="text-2xl font-black text-foreground">{(data.riskProbability * 10).toFixed(1)}/10</div>
          <div className="text-[10px] mt-1" style={{ color: stressColor }}>{stressLabel}</div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Revenue Trajectory Forecast</h4>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="fcastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.08} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `K${v / 1000}k`} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px" }} formatter={(v: any) => [fmt(v), "Est. Inflow"]} />
              <Area type="monotone" dataKey="value" stroke={accentColor} strokeWidth={3} fillOpacity={1} fill="url(#fcastGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zone Classification */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "0–3: Healthy", color: "#10b981" },
          { label: "3–6: Watch", color: "#f59e0b" },
          { label: "6–10: Risk Zone", color: "#f43f5e" },
        ].map(z => (
          <div key={z.label} className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border" style={{ borderColor: z.color + "40", color: z.color, backgroundColor: z.color + "0d" }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />
            {z.label}
          </div>
        ))}
      </div>
    </ReportShell>
  );
}

// ── Risk Concentration ────────────────────────────────────────────────────────
function RiskReportPreview({ data, onExport }: { data: any; onExport: () => void }) {
  const radialData = data.riskClusters.map((c: any, i: number) => ({
    name: c.name, value: +(c.balance / (data.riskClusters.reduce((s: number, cl: any) => s + cl.balance, 0)) * 100).toFixed(0),
    fill: ["#f59e0b", "#f43f5e", "#8b5cf6"][i]
  }));

  return (
    <ReportShell title="Outstanding Balance Risk Concentration" badge="⭐" insight={data.insight} insights={data.insights} onExport={onExport}>
      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center justify-between">
        <div>
          <div className="text-[10px] text-amber-400 font-bold uppercase">Arrears Concentration Score</div>
          <div className="text-3xl font-black text-foreground">{(data.concentration * 100).toFixed(0)}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">of outstanding balances in concentrated clusters</div>
        </div>
        <div className="w-24 h-24">
          <ResponsiveContainer>
            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData}>
              <RadialBar dataKey="value" />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        {data.riskClusters.map((cluster: any, i: number) => {
          const colors = ["#f59e0b", "#f43f5e", "#8b5cf6"];
          const c = colors[i % colors.length];
          const maxBalance = data.riskClusters.reduce((m: number, cl: any) => Math.max(m, cl.balance), 0);
          return (
            <div key={i} className="p-4 rounded-2xl border border-border/50 bg-card/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                  <span className="font-bold text-foreground text-sm">{cluster.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-black text-foreground font-mono">{fmt(cluster.balance)}</div>
                  <div className="text-[10px] text-muted-foreground">{cluster.count} students</div>
                </div>
              </div>
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(cluster.balance / maxBalance) * 100}%`, backgroundColor: c }} />
              </div>
            </div>
          );
        })}
      </div>
    </ReportShell>
  );
}

// ── Transaction Map ───────────────────────────────────────────────────────────
function TransactionMapPreview({ data, onExport }: { data: any; onExport: () => void }) {
  return (
    <ReportShell title="Multi-Student Transaction Mapping" insight={data.insight} onExport={onExport}>
      <div className="overflow-hidden rounded-2xl border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/20">
              <th className="text-left p-3 font-bold text-muted-foreground uppercase tracking-wider">Student</th>
              <th className="text-left p-3 font-bold text-muted-foreground uppercase tracking-wider">Admission</th>
              <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Total Paid</th>
              <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Payments</th>
              <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Last Date</th>
            </tr>
          </thead>
          <tbody>
            {data.students.slice(0, 15).map((s: any, i: number) => (
              <tr key={i} className="border-t border-border/30 hover:bg-muted/10 transition-colors">
                <td className="p-3 font-medium text-foreground">{s.name}</td>
                <td className="p-3 text-muted-foreground font-mono">{s.admission}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-400">{fmt(s.total)}</td>
                <td className="p-3 text-right text-foreground">{s.count}</td>
                <td className="p-3 text-right text-muted-foreground">{s.lastDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.students.length > 15 && (
          <div className="p-3 text-center text-[10px] text-muted-foreground border-t border-border/30 bg-muted/10">
            + {data.students.length - 15} more students. Export CSV for full report.
          </div>
        )}
      </div>
    </ReportShell>
  );
}
