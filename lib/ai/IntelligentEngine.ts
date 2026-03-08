import { CognitiveCore, BehavioralSignals, PredictionResult } from './CognitiveCore';

export interface StudentContext {
  studentId?: string;
  name?: string;
  className?: string;
  eventName?: string;
}

export interface AttendanceData {
  avgAttendance: number;
  threshold: number;
  atRiskCount?: number;
  perfectAttendanceCount?: number;
  dailyTrend: any[]; // Array of {date, rate/present_pct}
  classBars?: any[];
  belowThresholdCount?: number;
  atRiskStudents?: any[];
  summaries?: any[]; 
  recentDays?: any[];
  volatility?: number;
}

export interface FinanceData {
  revenueTrend?: any[];
  revenueByEvent?: any[];
  methodCounts?: Record<string, number>;
  statusCounts?: {
    paid: number;
    pending: number;
    partial: number;
    refunded: number;
  };
  paymentHistory?: any[];
  balanceTrend?: number; // Added for AGI signals
}

export interface EngineResult {
  student_id: string;
  success_score: number;
  zone: string;
  dropout_risk: number;
  academic_insight: string;
  attendance_insight: string;
  payment_insight: string;
  suggested_action: string;
}

export class IntelligentEngine {
  /**
   * Main entry point for generating Superintelligent insights.
   * Powered by the native TypeScript Centralized Cognitive Intelligence Core (CCIC).
   */
  static async process(type: string, data: any, context: StudentContext): Promise<any> {
    // 1. Extract Behavioral Signals for CCIC
    const signals: BehavioralSignals = this.extractSignals(type, data);

    // 2. Perform Cognitive Inference
    const studentId = context.studentId || "anonymous";
    const inference = await CognitiveCore.infer(studentId, signals);

    // 3. Generate Domain-Specific Augmented Insights
    if (type === "admin-attendance") return this.generateAdminAttendanceInsight(data, inference);
    if (type === "student-attendance") return this.generateStudentInsight(data, context, inference);
    if (type === "finance-analytics") return this.generateFinanceInsight(data, inference);
    
    return { 
      insight: inference.insights[0],
      success_score: inference.successScore,
      zone: inference.zone,
      dropout_risk: inference.dropoutRisk,
      trajectory: inference.trajectory
    };
  }

  /**
   * Maps raw domain data to normalized Behavioral Signals (Signal Fusion)
   */
  private static extractSignals(type: string, data: any): BehavioralSignals {
    return {
      attendanceRate: (data.avgAttendance || 0) / 100,
      attendanceStability: Math.max(0, 1 - (data.volatility || 0.1)),
      paymentReliability: this.calculatePaymentReliability(data),
      engagementVelocity: data.engagementVelocity || 0.85,
      academicPerformanceTrend: data.academicTrend || 0.75
    };
  }

  private static calculatePaymentReliability(data: any): number {
    const statusCounts = data.statusCounts;
    const balanceTrend = data.balanceTrend || 0; // Positive means increasing debt
    
    if (!statusCounts) return 1.0;
    const total = (statusCounts.paid || 0) + (statusCounts.pending || 0) + (statusCounts.partial || 0);
    if (total === 0) return 1.0;
    
    const baseReliability = (statusCounts.paid || 0) / total;
    // Penalty for increasing debt trajectory
    return Math.max(0, baseReliability - (balanceTrend > 0 ? 0.2 : 0));
  }

  private static generateAdminAttendanceInsight(data: AttendanceData, inference: PredictionResult): any {
    let insight = `### AGI Intelligence Report [Zone: ${inference.zone}]\n\n`;
    insight += `**Global Success Score:** ${(inference.successScore * 100).toFixed(1)}%\n`;
    insight += `**Trend Forecast:** ${inference.trajectory ? inference.trajectory.forecastedSuccess > inference.successScore ? 'Positive Growth' : 'Decay Detected' : 'Baseline'}\n\n`;
    
    if (inference.successScore > 0.8) {
      insight += `System status is **Elite**. Educational strategies are highly effective. `;
    } else {
      insight += `Cognitive volatility detected in **${data.belowThresholdCount || 'Several'}** segments. `;
    }

    insight += `\n\n**AGI Insight:** ${inference.insights[0]}`;

    return {
      insight: insight,
      success_score: inference.successScore,
      zone: inference.zone,
      dropout_risk: inference.dropoutRisk,
      trajectory: inference.trajectory
    };
  }

  private static async generateStudentInsight(data: any, context: StudentContext, inference: PredictionResult): Promise<any> {
    let insight = `### Welcome back, ${context.name || 'Scholar'}! 🧠\n\n`;
    insight += `Your **Success Index** is currently **${(inference.successScore * 100).toFixed(1)}%**, placing you in the **${inference.zone}**. `;
    
    if (inference.trajectory) {
       insight += `\n\n**Academic Velocity:** ${(inference.trajectory.academicSlope * 100).toFixed(2)}% improvement gradient.`;
    }

    insight += `\n\n**Intervention Insight:** ${inference.insights[1] || inference.insights[0]}`;

    return {
      insight: insight,
      success_score: inference.successScore,
      zone: inference.zone,
      dropout_risk: inference.dropoutRisk,
      trajectory: inference.trajectory
    };
  }

  private static generateFinanceInsight(data: FinanceData, inference: PredictionResult): any {
    let insight = `### Financial Velocity Report\n\n`;
    insight += `**Payment Reliability:** ${(inference.successScore * 100).toFixed(1)}%\n`;
    insight += `**Collection Status:** ${inference.zone}\n\n`;
    
    if (data.balanceTrend && data.balanceTrend > 0) {
       insight += `⚠️ **Risk Signal:** Outstanding balance trajectory is increasing. `;
    }

    return {
      insight: insight,
      success_score: inference.successScore,
      zone: inference.zone,
      payment_risk: inference.dropoutRisk,
      trajectory: inference.trajectory
    };
  }
}

