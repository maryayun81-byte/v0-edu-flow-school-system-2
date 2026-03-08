import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface StrategyWeight {
  domain: string;
  interventionType: string;
  weight: number;
  effectiveness: number;
}

export class OutcomeReinforcer {
  /**
   * Records the start of an intervention feedback loop.
   */
  static async recordIntervention(studentId: string, insightId: string, interventionType: string) {
    try {
      const { error } = await supabase
        .from('intervention_outcomes')
        .insert({
          insight_id: insightId,
          student_id: studentId,
          action_taken: interventionType,
          status: 'pending_verification'
        });

      if (error) throw error;
    } catch (error) {
      console.error('[OutcomeReinforcer] Error recording intervention:', error);
    }
  }

  /**
   * Learns from outcomes and updates strategy weights.
   * New_Weight = 0.9 * Old_Weight + 0.1 * Observed_Impact
   */
  static async updateStrategyWeights(outcomeId: string, deltaBehavior: number, deltaAcademic: number) {
    try {
      // 1. Fetch the outcome record to get domain and intervention type
      const { data: outcome, error: fetchErr } = await supabase
        .from('intervention_outcomes')
        .select('*, ai_insight_memory(domain)')
        .eq('id', outcomeId)
        .single();

      if (fetchErr || !outcome) throw fetchErr || new Error('Outcome not found');

      const domain = (outcome.ai_insight_memory as any).domain;
      const interventionType = outcome.action_taken;
      const totalImpact = (deltaBehavior * 0.7) + (deltaAcademic * 0.3);

      // 2. Update Weights using Reinforcement Learning Rule
      const { data: currentWeight } = await supabase
        .from('intervention_strategy_weights')
        .select('*')
        .eq('domain', domain)
        .eq('intervention_type', interventionType)
        .single();

      const oldWeight = currentWeight?.weight || 0.5;
      const newWeight = (0.9 * oldWeight) + (0.1 * totalImpact);

      await supabase
        .from('intervention_strategy_weights')
        .upsert({
          domain,
          intervention_type: interventionType,
          weight: Math.min(1, Math.max(0, newWeight)),
          effectiveness_score: totalImpact,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'domain,intervention_type'
        });

      // 3. Mark outcome as verified
      await supabase
        .from('intervention_outcomes')
        .update({
          behavioral_impact: deltaBehavior,
          academic_impact: deltaAcademic,
          success_index_gain: totalImpact,
          status: 'verified',
          verified_at: new Date().toISOString()
        })
        .eq('id', outcomeId);

    } catch (error) {
      console.error('[OutcomeReinforcer] RL Update Error:', error);
    }
  }

  /**
   * Selects the most effective intervention type for a specific domain.
   */
  static async getBestStrategy(domain: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('intervention_strategy_weights')
        .select('intervention_type')
        .eq('domain', domain)
        .order('weight', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return 'Standard Insight';
      return data[0].intervention_type;
    } catch {
      return 'Standard Insight';
    }
  }
}
