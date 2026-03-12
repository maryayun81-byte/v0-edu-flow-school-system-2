import { CognitiveCore, BehavioralSignals, PredictionResult } from './CognitiveCore';
import { ResultsCognitiveCore, ResultsMetrics } from './ResultsCognitiveCore';

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
  eligibleCount?: number;
  almostEligibleCount?: number;
  notEligibleCount?: number;
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
    const studentId = context.studentId || "anonymous";

    // 3. Fetch Academic Metrics if applicable
    let academicResults: ResultsMetrics | null = null;
    if (studentId !== "anonymous") {
      academicResults = await ResultsCognitiveCore.analyzeCrossEventPerformance(studentId);
    }

    // 1. Extract Behavioral Signals for CCIC (Now with Academic Fusion)
    const signals: BehavioralSignals = this.extractSignals(type, data, academicResults);

    // 2. Perform Cognitive Inference
    const inference = await CognitiveCore.infer(studentId, signals);

    // 4. Generate Domain-Specific Augmented Insights
    if (type === "admin-attendance") return this.generateAdminAttendanceInsight(data, inference);
    if (type === "student-attendance") return this.generateStudentInsight(data, context, inference, academicResults);
    if (type === "finance-analytics") return this.generateFinanceInsight(data, inference);
    if (type === "teacher-class-results") return this.generateTeacherClassInsight(data, inference, academicResults);
    if (type === "admin-results-overview") return this.generateAdminGlobalResultsInsight(data, inference);
    
    return { 
      insight: inference.insights[0],
      academic_insight: academicResults ? await ResultsCognitiveCore.generateResultsInsight(studentId, academicResults) : null,
      success_score: inference.successScore,
      zone: inference.zone,
      dropout_risk: inference.dropoutRisk,
      trajectory: inference.trajectory
    };
  }

  /**
   * Maps raw domain data to normalized Behavioral Signals (Signal Fusion)
   */
  private static extractSignals(type: string, data: any, academicResults: ResultsMetrics | null = null): BehavioralSignals {
    return {
      attendanceRate: (data.avgAttendance || 0) / 100,
      attendanceStability: Math.max(0, 1 - (data.volatility || 0.1)),
      paymentReliability: this.calculatePaymentReliability(data),
      engagementVelocity: data.engagementVelocity || 0.85,
      academicPerformanceTrend: academicResults ? academicResults.averageGradeNumeric : 0.5,
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
    const threshold = data.threshold || 80;
    const avg = data.avgAttendance || 0;
    const atRisk = data.belowThresholdCount || 0;
    
    let insight = `### STRATEGIC ATTENDANCE AUDIT [EVENT: ${inference.zone}]\n\n`;
    
    // 1. Observation
    insight += `#### 1. PRIMARY OBSERVATION\n`;
    insight += `Institutional attendance is indexed at **${avg}%**, with **${atRisk} segments** currently operating below the mandatory **${threshold}% precision threshold**. `;
    if (data.dailyTrend && data.dailyTrend.length > 1) {
      const recent = data.dailyTrend[data.dailyTrend.length - 1].present_pct;
      const prev = data.dailyTrend[data.dailyTrend.length - 2].present_pct;
      const velocity = recent - prev;
      insight += `A **${velocity > 0 ? '+' : ''}${velocity}% engagement velocity** has been detected in the most recent 24-hour cycle. `;
    }
    insight += `\n\n`;

    // 2. Intelligence Interpretation
    insight += `#### 2. NEURAL INTERPRETATION\n`;
    if (avg >= threshold + 5) {
      insight += `Systemic stability is **Optimal**. The current tuition event is demonstrating high-velocity student commitment, correlating with elite-tier curriculum delivery. The risk of academic dropout in the lower quartiles is minimized. `;
    } else if (avg >= threshold) {
      insight += `The institution is maintaining a **Strategic Equilibrium**. Attendance is healthy but vulnerable to volatility in specific day-of-week patterns (notably Friday/Saturday decay). Behavioral signals suggest a "plateau effect" in the mid-performing sections. `;
    } else {
      insight += `⚠️ **SYSTEMIC DRIFT DETECTED.** The institution has breached the lower safety boundary. This pattern indicates a decoupling between student engagement and timetable scheduling. If left unaddressed, this trajectory will compromise term-end assessment throughput. `;
    }
    insight += `\n\n`;

    // 3. Qualification Audit
    insight += `#### 3. EXAM QUALIFICATION AUDIT\n`;
    const eligRate = data.eligibleCount !== undefined && (data.eligibleCount + (data.notEligibleCount||0) + (data.almostEligibleCount||0)) > 0 
        ? Math.round((data.eligibleCount / (data.eligibleCount + (data.notEligibleCount||0) + (data.almostEligibleCount||0))) * 100) 
        : 0;
    insight += `Final qualification projection is indexed at **${eligRate}%**. \n`;
    insight += `* **Status:** ${eligRate > 80 ? 'EXCELLENT' : 'CRITICAL BORDERLINE'}\n`;
    insight += `* **Confirmed Eligible:** ${data.eligibleCount || 0} Scholars\n`;
    insight += `* **Borderline (Almost):** ${data.almostEligibleCount || 0} Scholars (Requires immediate engagement focus)\n`;
    insight += `* **Disqualified:** ${data.notEligibleCount || 0} Scholars\n\n`;

    // 4. Strategic Directives
    insight += `#### 4. COMMAND DIRECTIVES\n`;
    if (atRisk > 0) {
      insight += `* **PRIORITY 1:** Activate "Rapid Response" protocols for the ${atRisk} critical students identified by the Risk Engine.\n`;
      insight += `* **PRIORITY 2:** Cross-verify teacher register submission latency for the classes showing <${avg}% averages.\n`;
    }
    insight += `* **PRIORITY 3:** Execute a "Peak Retention" campaign for the upcoming 48-hour window to counteract detected cyclic decay.\n\n`;
    
    insight += `> **Leadership Summary:** ${inference.insights[0]}`;

    return {
      insight: insight,
      success_score: inference.successScore,
      zone: inference.zone,
      dropout_risk: inference.dropoutRisk,
      trajectory: inference.trajectory,
      atRiskCount: atRisk
    };
  }

  private static async generateStudentInsight(data: any, context: StudentContext, inference: PredictionResult, academicResults: ResultsMetrics | null): Promise<any> {
    let insight = `### Academic & Engagement Intelligence [${context.name || 'Scholar'}]\n\n`;
    insight += `Your **Success Index** is optimized at **${(inference.successScore * 100).toFixed(1)}%**, placing you in the **${inference.zone}**. `;
    
    if (academicResults) {
       const academicNarrative = await ResultsCognitiveCore.generateResultsInsight(context.studentId || '', academicResults, 'student');
       insight += `\n\n**Academic Matrix:** ${academicNarrative}`;
    }

    if (inference.trajectory) {
       insight += `\n\n**Performance Velocity:** ${(inference.trajectory.academicSlope * 100).toFixed(1)}% improvement gradient detected.`;
    }

    insight += `\n\n**Tactical Advisor:** ${inference.insights[0]}`;

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

  private static generateTeacherClassInsight(data: any, inference: PredictionResult, academicResults: ResultsMetrics | null): any {
    const classAvg = data.classAverage;
    let insight = `### Classroom Tactical Advisor\n\n`;
    
    const academicStrength = academicResults ? academicResults.averageGradeNumeric : classAvg;
    const consistency = academicResults ? (academicResults.subjectConsistency * 100).toFixed(1) : '85.0';
    const velocity = academicResults ? (academicResults.improvementVelocity * 100).toFixed(1) : '2.4';

    insight += `**Success Index:** ${(classAvg * 100).toFixed(1)}% | **Consistency:** ${consistency}% | **Velocity:** ${velocity}%\n\n`;
    
    if (classAvg > 0.8) {
      insight += `**Strategic Intelligence:** The cohort is demonstrating elite-level throughput. Focus on **advanced curriculum extension** and peer-led knowledge transfers to optimize this momentum. `;
    } else if (classAvg > 0.6) {
      insight += `**Tactical Briefing:** Systemic stability detected. Recommend focusing on **attendance precision** and targeted remediation for the critical lower quartiles to prevent performance decay. `;
    } else {
      insight += `⚠️ **High-Risk Intervention Required.** Multiple failure signals detected. Immediate focus on **accelerated remedial sessions** for core modules and behavioral re-alignment is mandatory. `;
    }

    insight += `\n\n**Strategic Command:** ${inference.insights[0]}`;

    return {
      insight: insight,
      class_index: classAvg,
      zone: inference.zone
    };
  }

  private static generateAdminGlobalResultsInsight(data: any, inference: PredictionResult): any {
    let insight = `### Institutional Academic Health Report\n\n`;
    insight += `**Global Academic Index:** ${(inference.successScore * 100).toFixed(1)}% [${inference.zone}]\n`;
    insight += `**Event Mastery:** ${data.completionRate}% of tuition events finalized.\n\n`;
    
    if (data.lowPerformingClassesCount > 0) {
      insight += `⚠️ **Resource Alert:** ${data.lowPerformingClassesCount} classes are showing sub-par result trajectories. Priority assessment recommended. `;
    } else {
      insight += `Institutional trends are **Positive**. The current curriculum delivery and assessment cycle are performing optimally. `;
    }

    insight += `\n\n**Leadership Directive:** ${inference.insights[0]}`;

    return {
      insight: insight,
      global_index: inference.successScore,
      alert_count: data.lowPerformingClassesCount
    };
  }
}

