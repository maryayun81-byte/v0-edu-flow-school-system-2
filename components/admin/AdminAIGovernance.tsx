'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, 
  Settings, 
  RefreshCw, 
  ShieldCheck, 
  Activity, 
  AlertTriangle,
  Save,
  Database,
  LineChart,
  Target,
  Zap,
  Sparkles
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export default function AdminAIGovernance() {
  const [config, setConfig] = useState<any>({
    learning_mode: 'Batch Learning Mode',
    learning_aggression_level: 'Balanced',
    intervention_mode: 'Semi-automatic',
    retraining_interval_days: 7,
    drift_sensitivity_level: 'Moderate',
    intervention_aggressive_level: 'Moderate',
    prediction_confidence_threshold: 0.85,
    retraining_sensitivity: 0.6,
    narrative_style: 'Balanced'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [strategies, setStrategies] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: configData } = await supabase
        .from('ai_governance_config')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (configData) setConfig(configData);

      const { data: strategyData } = await supabase
        .from('intervention_strategy_weights')
        .select('*')
        .order('weight', { ascending: false });
      
      if (strategyData) setStrategies(strategyData);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('ai_governance_config')
      .update(config)
      .eq('is_active', true);
    
    if (!error) {
      // Logic for successful save
    }
    setSaving(false);
  };

  if (loading) return <div className="animate-pulse h-64 bg-white/5 rounded-2xl" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-indigo-400" />
            Superintelligent AGI Governance
          </h2>
          <p className="text-gray-400">Control the native Centralized Cognitive Intelligence Core (CCIC)</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Apply AGI Configuration
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Learning & Aggression Strategy */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Intelligence & Learning Strategy
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {['Observation Mode', 'Batch Learning Mode', 'Adaptive Learning Mode'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setConfig({ ...config, learning_mode: mode })}
                  className={`p-4 rounded-xl border transition-all text-left ${
                    config.learning_mode === mode
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="font-bold mb-1 text-sm">{mode}</div>
                  <div className="text-[10px] opacity-70">
                    {mode === 'Observation Mode' && 'Passive telemetry collection only.'}
                    {mode === 'Batch Learning Mode' && 'Scheduled native weight updates.'}
                    {mode === 'Adaptive Learning Mode' && 'Real-time trajectory forecasting.'}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
               {['Conservative', 'Balanced', 'Aggressive'].map((level) => (
                <button
                  key={level}
                  onClick={() => setConfig({ ...config, learning_aggression_level: level })}
                  className={`p-3 rounded-xl border transition-all text-center ${
                    config.learning_aggression_level === level
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="text-xs font-bold">Learning: {level}</div>
                </button>
              ))}
            </div>

            {/* NEW: Prediction Confidence Threshold */}
            <div className="space-y-4 pt-4 border-t border-white/10">
               <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-white uppercase tracking-wider">Prediction Confidence Threshold</label>
                  <span className="text-indigo-400 font-mono font-bold">{(config.prediction_confidence_threshold * 100).toFixed(0)}%</span>
               </div>
               <input 
                  type="range" 
                  min="0.5" 
                  max="0.99" 
                  step="0.01"
                  value={config.prediction_confidence_threshold}
                  onChange={(e) => setConfig({ ...config, prediction_confidence_threshold: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
               />
               <p className="text-[10px] text-gray-500 leading-relaxed italic">
                  Determines the minimum certainty required for the engine to display a trajectory forecast to students.
               </p>
            </div>
          </div>

          {/* Intervention Orchestration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-green-400" />
                Intervention Orchestration
              </h3>
              <div className="space-y-4">
                {['Recommendation only', 'Semi-automatic', 'Autonomous strategy'].map((mode) => (
                  <label key={mode} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <input 
                      type="radio" 
                      name="inter_mode" 
                      checked={config.intervention_mode === mode}
                      onChange={() => setConfig({ ...config, intervention_mode: mode })}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-gray-300">{mode}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                Narrative Personality Layer
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-bold uppercase tracking-widest text-[10px]">Narrative Style Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Conservative', 'Balanced', 'Advanced', 'Experimental'].map((style) => (
                      <button
                        key={style}
                        onClick={() => setConfig({ ...config, narrative_style: style })}
                        className={`p-2 rounded-lg border text-[10px] font-black uppercase transition-all ${
                          config.narrative_style === style
                            ? 'bg-blue-600/20 border-blue-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-500'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase text-gray-400">
                      <span>Retraining Sensitivity</span>
                      <span className="text-blue-400">{(config.retraining_sensitivity * 10).toFixed(1)}/10</span>
                   </div>
                   <input 
                      type="range" 
                      min="0.1" 
                      max="1.0" 
                      step="0.1"
                      value={config.retraining_sensitivity}
                      onChange={(e) => setConfig({ ...config, retraining_sensitivity: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                   />
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
                  <p className="text-[10px] text-blue-200/80 leading-relaxed italic">
                    God Mode: Autonomous Memory Personality Layer active. AI will now generate student identity vectors.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reinforcement Learning Strategy Weights */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Strategy Effectiveness (RL)
          </h3>
          <div className="space-y-4 overflow-y-auto max-h-[600px]">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white font-medium text-xs">{strategy.intervention_type}</div>
                  <div className="text-[10px] text-gray-500 uppercase">{strategy.domain}</div>
                </div>
                
                {/* Weight Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Mastery Weight</span>
                    <span>{(strategy.weight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000" 
                      style={{ width: `${strategy.weight * 100}%` }} 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] mt-3">
                  <Target className={`w-3 h-3 ${strategy.effectiveness_score > 0 ? 'text-green-400' : 'text-red-400'}`} />
                  <span className={strategy.effectiveness_score > 0 ? 'text-green-400' : 'text-red-400'}>
                    Impact: {strategy.effectiveness_score > 0 ? '+' : ''}{(strategy.effectiveness_score * 100).toFixed(1)}% gain
                  </span>
                </div>
              </div>
            ))}
            {strategies.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm italic">Initializing Outcome Intelligence...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
