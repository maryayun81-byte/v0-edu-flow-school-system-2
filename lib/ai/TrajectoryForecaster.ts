import { createClient } from '@/lib/supabase/client';
import { BehavioralSignals } from './CognitiveCore';

const supabase = createClient();

export interface TrajectoryMetrics {
  successGain: number;       // Change in success score since last snapshot
  attendanceVolatility: number; // Variance in attendance
  engagementGradient: number;  // Slope of engagement over time
  academicSlope: number;      // Improvement rate gradient
  forecastedSuccess: number;  // Predicted success score for next period
}

export interface BehavioralTrajectory {
  id: string;
  student_id: string;
  snapshot_date: string;
  success_score: number;
  attendance_stability: number;
  payment_reliability: number;
  engagement_velocity: number;
  academic_performance_trend: number;
  signals_json: any;
  created_at: string;
}

export class TrajectoryForecaster {
  /**
   * Records a point-in-time snapshot of student signals for sequence modelling.
   */
  static async recordTrajectory(studentId: string, signals: BehavioralSignals, successScore: number) {
    try {
      const { error } = await supabase
        .from('behavioral_trajectories')
        .upsert({
          student_id: studentId,
          snapshot_date: new Date().toISOString().split('T')[0],
          success_score: successScore,
          attendance_stability: signals.attendanceStability,
          payment_reliability: signals.paymentReliability,
          engagement_velocity: signals.engagementVelocity,
          academic_performance_trend: signals.academicPerformanceTrend,
          signals_json: signals
        });

      if (error) throw error;
    } catch (error) {
      console.error('[TrajectoryForecaster] Error recording trajectory:', error);
    }
  }

  /**
   * Computes trajectory metrics by analyzing historical snapshots.
   * Uses simple linear regression to find gradients (slopes).
   */
  static async getTrajectoryMetrics(studentId: string, windowDays: number = 30): Promise<TrajectoryMetrics> {
    const defaultMetrics: TrajectoryMetrics = {
      successGain: 0,
      attendanceVolatility: 0,
      engagementGradient: 0,
      academicSlope: 0,
      forecastedSuccess: 0.5
    };

    try {
      const { data: snapshots, error } = await supabase
        .from('behavioral_trajectories')
        .select('*')
        .eq('student_id', studentId)
        .order('snapshot_date', { ascending: false })
        .limit(windowDays) as { data: BehavioralTrajectory[] | null, error: any };

      if (error) throw error;
      if (!snapshots || snapshots.length < 2) return defaultMetrics;

      const latest = snapshots[0];
      const oldest = snapshots[snapshots.length - 1];

      // 1. Success Gain
      const successGain = latest.success_score - oldest.success_score;

      // 2. Attendance Volatility (Standard Deviation approx)
      const attendanceScores = snapshots.map((s: BehavioralTrajectory) => s.attendance_stability);
      const avgAttendance = attendanceScores.reduce((a: number, b: number) => a + b, 0) / attendanceScores.length;
      const variance = attendanceScores.reduce((a: number, b: number) => a + Math.pow(b - avgAttendance, 2), 0) / attendanceScores.length;
      const attendanceVolatility = Math.sqrt(variance);

      // 3. Gradients (Simplified slope: (y2 - y1) / count)
      const count = snapshots.length;
      const engagementGradient = (latest.engagement_velocity - oldest.engagement_velocity) / count;
      const academicSlope = (latest.academic_performance_trend - oldest.academic_performance_trend) / count;

      // 4. Forecasted Success (Simple projection: Current + (Avg Gradient * 7 days))
      const forecastedSuccess = Math.min(1, Math.max(0, latest.success_score + (successGain / count) * 7));

      return {
        successGain,
        attendanceVolatility,
        engagementGradient,
        academicSlope,
        forecastedSuccess
      };
    } catch (error) {
      console.error('[TrajectoryForecaster] Metrics Error:', error);
      return defaultMetrics;
    }
  }

  /**
   * Detects sequential behavioral state changes.
   * E.g., From "Stable Attendance" to "Declining Attendance".
   */
  static analyzeTrend(metrics: TrajectoryMetrics): string {
    if (metrics.academicSlope < -0.05) return 'Rapid Academic Degradation';
    if (metrics.attendanceVolatility > 0.3) return 'High Attendance Instability';
    if (metrics.engagementGradient < -0.02) return 'Active Disengagement Pattern';
    if (metrics.successGain > 0.1) return 'Significant Performance Growth';
    return 'Stable Behavioral Trajectory';
  }
}
