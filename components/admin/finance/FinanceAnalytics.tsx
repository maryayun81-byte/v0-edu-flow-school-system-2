"use client";

import { useState, useMemo } from "react";
import { Sparkles, Loader2, RefreshCcw, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import type { Payment, TuitionEvent } from "./types";

interface Props {
  payments: Payment[];
  events: TuitionEvent[];
}

function fmt(n: number) { return `KSh ${Math.round(n).toLocaleString()}`; }

export default function FinanceAnalytics({ payments, events }: Props) {
  const paid = payments.filter(p => p.status === "paid");

  // Revenue by Event (bar chart)
  const revenueByEvent = useMemo(() => {
    return events.map(e => {
      const total = paid.filter(p => p.event_id === e.id).reduce((s, p) => s + p.amount, 0);
      return { name: e.name, total };
    }).filter(x => x.total > 0);
  }, [events, paid]);

  const maxRevenue = Math.max(1, ...revenueByEvent.map(x => x.total));

  // Payment Method Distribution
  const methodCounts = useMemo(() => {
    const counts: Record<string, number> = { mpesa: 0, cash: 0, bank_transfer: 0, card: 0, other: 0 };
    paid.forEach(p => { counts[p.payment_method] = (counts[p.payment_method] || 0) + 1; });
    return counts;
  }, [paid]);

  const totalTx = paid.length || 1;
  const methodColors: Record<string, { bar: string; dot: string }> = {
    mpesa:        { bar: "from-green-500 to-emerald-500", dot: "bg-green-500" },
    cash:         { bar: "from-amber-500 to-yellow-500", dot: "bg-amber-500" },
    bank_transfer:{ bar: "from-blue-500 to-cyan-500",    dot: "bg-blue-500" },
    card:         { bar: "from-violet-500 to-purple-500",dot: "bg-violet-500" },
    other:        { bar: "from-gray-500 to-slate-500",   dot: "bg-gray-500" },
  };
  const methodLabels: Record<string, string> = { mpesa: "M-Pesa", cash: "Cash", bank_transfer: "Bank Transfer", card: "Card", other: "Other" };

  // Payment Status Distribution
  const statusCounts = useMemo(() => ({
    paid:    payments.filter(p => p.status === "paid").length,
    pending: payments.filter(p => p.status === "pending").length,
    partial: payments.filter(p => p.status === "partial").length,
    refunded:payments.filter(p => p.status === "refunded").length,
  }), [payments]);
  const totalStatus = payments.length || 1;

  // Revenue trend (last 30 days)
  const revenueByDay = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
      days[d] = 0;
    }
    paid.forEach(p => { if (p.payment_date in days) days[p.payment_date] += p.amount; });
    return Object.entries(days).map(([date, total]) => ({ date: date.slice(5), total }));
  }, [paid]);
  const maxDay = Math.max(1, ...revenueByDay.map(d => d.total));

  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  async function generateAiInsights() {
    setIsGeneratingAi(true);
    setAiInsight("");
    
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "finance-analytics",
          data: {
            revenueTrend: revenueByDay,
            revenueByEvent: revenueByEvent,
            methodCounts: methodCounts,
            statusCounts: statusCounts
          },
          context: {
            financeId: "global-analytics"
          }
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setAiInsight(result.insight);
      toast.success("Strategic financial insights generated!");
    } catch (error: any) {
      console.error("AI Insight Error:", error);
      toast.error(error.message || "Failed to generate AI insights");
    } finally {
      setIsGeneratingAi(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Revenue Trend (last 7 days) */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6">
        <h3 className="font-bold text-foreground mb-5">Revenue Trend – Last 7 Days</h3>
        <div className="flex items-end gap-2 h-32">
          {revenueByDay.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{d.total > 0 ? fmt(d.total) : ""}</span>
              <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-teal-400 transition-all duration-700 min-h-[4px]" style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}px` }} />
              <span className="text-[10px] text-muted-foreground">{d.date}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by Event */}
        <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6">
          <h3 className="font-bold text-foreground mb-5">Revenue by Event</h3>
          {revenueByEvent.length === 0 ? (
            <p className="text-muted-foreground text-sm">No event revenue data yet.</p>
          ) : (
            <div className="space-y-4">
              {revenueByEvent.map((e, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-foreground font-medium truncate max-w-[70%]">{e.name}</span>
                    <span className="text-emerald-400 font-bold text-xs">{fmt(e.total)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${(e.total / maxRevenue) * 100}%`, transition: "width 0.7s" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6">
          <h3 className="font-bold text-foreground mb-5">Payment Method Distribution</h3>
          <div className="space-y-3">
            {Object.entries(methodCounts).map(([method, count]) => {
              const pct = Math.round((count / totalTx) * 100);
              const colors = methodColors[method];
              return (
                <div key={method}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${colors?.dot}`} />
                      <span className="text-foreground">{methodLabels[method]}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{count} txn · {pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${colors?.bar}`} style={{ width: `${pct}%`, transition: "width 0.7s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Payment Status Distribution */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6">
        <h3 className="font-bold text-foreground mb-5">Payment Status Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "paid",     label: "Fully Paid",     color: "from-emerald-500 to-green-600",  text: "text-emerald-400" },
            { key: "partial",  label: "Partially Paid", color: "from-blue-500 to-cyan-600",      text: "text-blue-400" },
            { key: "pending",  label: "Not Paid",       color: "from-amber-500 to-orange-600",   text: "text-amber-400" },
            { key: "refunded", label: "Refunded",       color: "from-gray-500 to-slate-600",     text: "text-gray-400" },
          ].map(({ key, label, color, text }) => {
            const count = statusCounts[key as keyof typeof statusCounts];
            const pct = Math.round((count / totalStatus) * 100);
            return (
              <div key={key} className="bg-muted/30 rounded-xl p-4 text-center">
                <div className={`text-3xl font-black ${text} mb-1`}>{count}</div>
                <div className="text-xs text-muted-foreground mb-2">{label}</div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial AI Insights Card */}
      <div className="relative group overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/10 shadow-xl p-8 mb-6 transition-all duration-500 hover:shadow-emerald-500/10 hover:border-emerald-500/40">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-emerald-500/15 transition-all duration-1000" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 animate-pulse">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
               <h4 className="text-xl font-black text-foreground tracking-tight uppercase">Strategic Finance Advisor</h4>
               <p className="text-[10px] text-emerald-500 font-bold tracking-[0.3em] uppercase opacity-70">Powered by Google Gemini AI · Real-time data analysis</p>
            </div>
          </div>
          <button
            onClick={generateAiInsights}
            disabled={isGeneratingAi}
            className="group relative flex items-center gap-3 px-6 py-3 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl disabled:opacity-50 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {isGeneratingAi ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                Processing Data...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 text-emerald-500 group-hover:rotate-180 transition-transform duration-700" />
                Generate Strategic Insight
              </>
            )}
          </button>
        </div>

        {aiInsight ? (
          <div className="relative z-10 bg-background/40 backdrop-blur-xl border border-emerald-500/10 rounded-[1.5rem] p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-strong:text-emerald-400 prose-headings:text-white prose-ul:text-slate-400">
               <div dangerouslySetInnerHTML={{ __html: aiInsight.replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center py-12 text-center bg-background/20 backdrop-blur-md rounded-[1.5rem] border border-dashed border-emerald-500/20 px-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/5 flex items-center justify-center mb-4">
               <TrendingUp className="w-6 h-6 text-emerald-500/20" />
            </div>
            <p className="text-sm text-muted-foreground font-medium max-w-sm leading-relaxed">
              Click the button above to unlock AI-driven financial insights. We'll analyze revenue patterns, payment distributions, and trends to help you optimize growth.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
