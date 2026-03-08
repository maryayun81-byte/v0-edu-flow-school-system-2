"use client";

import { useState } from 'react';
import { 
  ShieldCheck, 
  Settings2, 
  Eye, 
  Clock, 
  Activity,
  Zap,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

export default function FinanceGovernancePanel() {
  const [config, setConfig] = useState({
    insightAggressiveness: 'Balanced',
    predictionHorizon: 30,
    forecastDepth: 'Medium',
    autoInsight: true
  });
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Finance AI Governance updated.");
    }, 800);
  };

  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            Financial AI Governance
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Control the behavioral finance inference engine and forecasting behavior.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="p-3 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-white shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs flex items-center gap-2"
        >
          {saving ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Apply Governance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Insight Aggressiveness */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Insight Aggressiveness</label>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {['Conservative', 'Balanced', 'Advanced'].map((mode) => (
              <button
                key={mode}
                onClick={() => setConfig({...config, insightAggressiveness: mode})}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                  config.insightAggressiveness === mode
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                    : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <div>
                  <div className="font-bold text-sm">{mode}</div>
                  <div className="text-[10px] opacity-70">
                    {mode === 'Conservative' && 'Prioritize historical certainty over future projections.'}
                    {mode === 'Balanced' && 'Standard behavioral inference with moderate confidence.'}
                    {mode === 'Advanced' && 'Experimental trajectory modeling with multi-agent simulation.'}
                  </div>
                </div>
                {config.insightAggressiveness === mode && <ShieldCheck className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Prediction Settings */}
        <div className="space-y-6">
          <div className="space-y-4 p-5 bg-card/80 border border-border/50 rounded-2xl">
             <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold uppercase text-muted-foreground">Prediction Horizon</span>
                </div>
                <span className="text-indigo-400 font-mono font-bold">{config.predictionHorizon} Days</span>
             </div>
             <input 
                type="range" 
                min="30" 
                max="90" 
                step="30" 
                value={config.predictionHorizon}
                onChange={(e) => setConfig({...config, predictionHorizon: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-500"
             />
             <p className="text-[10px] text-muted-foreground leading-relaxed">
               Lower horizons prioritize short-term liquidity. 90-day window enables academic term-cycle modeling.
             </p>
          </div>

          <div className="space-y-4 p-5 bg-card/80 border border-border/50 rounded-2xl">
             <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-bold uppercase text-muted-foreground">Forecast Depth</span>
                </div>
                <span className="text-purple-400 font-mono font-bold uppercase text-[10px]">{config.forecastDepth}</span>
             </div>
             <div className="flex gap-2">
                {['Low', 'Medium', 'High'].map(d => (
                   <button 
                    key={d}
                    onClick={() => setConfig({...config, forecastDepth: d})}
                    className={`flex-1 py-2 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      config.forecastDepth === d 
                        ? 'bg-purple-600/10 border-purple-500 text-purple-400' 
                        : 'bg-muted/30 border-transparent text-muted-foreground'
                    }`}
                   >
                     {d}
                   </button>
                ))}
             </div>
          </div>

          <div className="flex items-center justify-between p-5 bg-indigo-600/5 border border-indigo-600/10 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 rounded-xl">
                  <Eye className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                   <div className="text-xs font-bold text-foreground">Auto-Insight generation</div>
                   <div className="text-[10px] text-muted-foreground">Regenerate on data growth threshold</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.autoInsight} 
                  onChange={(e) => setConfig({...config, autoInsight: e.target.checked})}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
          </div>
        </div>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
        <Activity className="w-5 h-5 text-yellow-500 shrink-0" />
        <p className="text-[10px] text-yellow-200/80 leading-relaxed italic">
          Financial Superintelligence Core (FSC) is currently in Stable Learning Mode. Model retraining will trigger once 100 new transactions are synchronized.
        </p>
      </div>
    </div>
  );
}
