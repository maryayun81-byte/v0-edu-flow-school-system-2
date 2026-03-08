"use client";

import { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Zap, 
  ShieldCheck, 
  Calendar,
  DollarSign,
  Activity,
  ArrowUpRight,
  Target
} from 'lucide-react';
import { FinanceCore, FinanceSignals, FinancePrediction } from '@/lib/ai/FinanceCore';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export default function FinanceIntelligenceOverview() {
  const [intelligence, setIntelligence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIntelligence() {
      const data = await FinanceCore.inferGlobalIntelligence();
      setIntelligence(data);
      setLoading(false);
    }
    loadIntelligence();
  }, []);

  if (loading) return <div className="animate-pulse h-96 bg-card/50 rounded-3xl border border-border/50" />;

  const { signals, prediction, insights, healthScore } = intelligence;

  // Mock forecast data for Recharts
  const forecastData = [
    { name: 'Current', revenue: signals.totalCollected },
    { name: '30 Days', revenue: prediction.expectedRevenue30d },
    { name: '60 Days', revenue: prediction.expectedRevenue60d },
    { name: '90 Days', revenue: prediction.expectedRevenue90d },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Zap className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-indigo-200" />
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Platform Financial Health</span>
            </div>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-6xl font-black">{healthScore}%</span>
              <div className="mb-2 py-1 px-3 bg-white/20 rounded-full text-[10px] font-bold uppercase">
                {prediction.riskClassification} Status
              </div>
            </div>
            <p className="text-sm text-indigo-100/80 max-w-sm">
              Current collection efficiency is high. Liquid reserves are sufficient for next cycle operations.
            </p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <Target className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target Achieved</div>
              <div className="text-lg font-bold text-foreground">{(signals.collectionEfficiency * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${signals.collectionEfficiency * 100}%` }} />
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl">
              <Activity className="w-6 h-6 text-orange-500" />
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Arrears Pressure</div>
              <div className="text-lg font-bold text-foreground">{(signals.arrearsConcentration * 100).toFixed(0)}%</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold">
            <TrendingUp className="w-3 h-3" />
            <span>High Concentration</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecast Visualization */}
        <div className="lg:col-span-2 bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                Revenue Trajectory Forecast
              </h3>
              <p className="text-xs text-muted-foreground">Predictive cashflow timeline based on historical collection curves.</p>
            </div>
            <div className="flex items-center gap-2 py-1 px-3 bg-indigo-500/10 rounded-full text-[10px] font-bold text-indigo-500 uppercase">
              <ShieldCheck className="w-3 h-3" />
              95% Confidence
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `K${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Narrative Intelligence Panel */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground px-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            FSC Insights
          </h3>
          <div className="space-y-3">
            {insights.map((insight: string, idx: number) => (
              <div key={idx} className="p-4 bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl hover:border-indigo-500/30 transition-colors group">
                <div className="flex gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:scale-150 transition-transform" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 bg-indigo-600/10 border border-indigo-600/20 rounded-2xl mt-4">
             <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-bold uppercase text-indigo-300">Stress Index Forecast</span>
             </div>
             <div className="text-2xl font-black text-indigo-400">{(prediction.cashflowStressIndex * 10).toFixed(1)}/10</div>
             <p className="text-[10px] text-muted-foreground mt-1 italic">
               Model predicts low stress for the current academic cycle.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
