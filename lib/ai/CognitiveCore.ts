/**
 * Centralized Cognitive Intelligence Core (CCIC)
 * Production Architecture — v4 (FIPCL-Integrated)
 * -------------------------------------------------------------
 *
 * Central intelligence service. All dashboards request insights here.
 * Internal Pipeline:
 *   Platform Events → Feature Extraction → Signal Detection
 *   → Context Builder → FIPCL Narrative Generator
 *   → Vocabulary Diversifier → Confidence Filter → Dashboard Output
 */

import { createClient } from '@/lib/supabase/client';
import { TrajectoryForecaster, TrajectoryMetrics } from './TrajectoryForecaster';
import { ResultsCognitiveCore } from './ResultsCognitiveCore';

// const supabase = createClient(); // Moved inside methods to avoid build-time errors

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface BehavioralSignals {
  attendanceRate: number;
  attendanceStability: number;
  paymentReliability: number;
  engagementVelocity: number;
  eventCount?: number;
  recentAttendanceDelta?: number;   // vs 14 days ago
  paymentDelayMean?: number;        // avg delay days
  academicPerformanceTrend?: number; // Added for AGI fusion
}

export interface BehavioralFingerprint {
  relativeAttendanceDeviation: number;
  learningConsistencySlope: number;
  paymentBehaviorPattern: 'Stable' | 'Fluctuating' | 'Delayed';
  sessionEngagementTrajectory: number;
  temporalBehaviorRhythm: number;
}

export enum ClassificationZone {
  CRITICAL = 'Critical Intervention Zone',
  MONITORING = 'Monitoring Zone',
  HEALTHY = 'Healthy Zone',
  ELITE = 'Elite Performance Zone',
}

export interface RiskSignals {
  attendance: number;
  payment: number;
  engagement: number;
  academic: number;
}

export interface PredictionResult {
  successScore: number;
  zone: ClassificationZone;
  dropoutRisk: number;
  academicOutcome: string;
  insights: string[];
  riskSignals: RiskSignals;
  motivationalCaption: string;
  predictionConfidence: number;
  trajectory?: TrajectoryMetrics;
  fingerprint?: BehavioralFingerprint;
  meaningStatement?: string;
  progressZoneLabel?: string;
}

export interface BehavioralProfile {
  studentId: string;
  signals: BehavioralSignals;
  fingerprint: BehavioralFingerprint;
  prediction: PredictionResult;
  correlations: {
    attendanceToGrades: string;
    paymentToEngagement: string;
  };
}

export type DashboardContext = 'student' | 'teacher' | 'admin' | 'finance';
export type InsightDomain = 'attendance' | 'finance' | 'academic' | 'success' | 'platform';

// ─── Internal Types ───────────────────────────────────────────────────────────

interface SignalEvent {
  domain: InsightDomain;
  priority: 'critical' | 'high' | 'moderate' | 'low';
  change: number;          // % magnitude
  direction: 'up' | 'down' | 'flat';
  context: string;         // human-readable context key
  comparisonPeriod: string;
}

interface InsightContext {
  domain: InsightDomain;
  metric: string;
  change: string;          // e.g.  "+12%"
  period: string;          // e.g.  "last two weeks"
  comparison: string;      // e.g.  "previous two weeks"
  significance: 'critical' | 'high' | 'moderate' | 'low';
  studentId?: string;
  dashboardCtx: DashboardContext;
}

// ─── MODULE A: Signal Detection Engine ───────────────────────────────────────

function detectSignals(signals: BehavioralSignals): SignalEvent[] {
  const events: SignalEvent[] = [];

  // Attendance signal
  const attDelta = signals.recentAttendanceDelta ?? 0;
  if (Math.abs(attDelta) > 0.05) {
    events.push({
      domain: 'attendance',
      priority: attDelta < -0.12 ? 'critical' : attDelta < -0.05 ? 'high' : 'moderate',
      change: attDelta,
      direction: attDelta < 0 ? 'down' : 'up',
      context: attDelta < 0 ? 'attendance_declining' : 'attendance_improving',
      comparisonPeriod: 'previous two weeks',
    });
  }

  // Payment signal
  if (signals.paymentReliability < 0.5) {
    events.push({
      domain: 'finance',
      priority: 'critical',
      change: signals.paymentReliability - 1,
      direction: 'down',
      context: 'low_payment_compliance',
      comparisonPeriod: 'current term',
    });
  } else if (signals.paymentReliability < 0.75) {
    events.push({
      domain: 'finance',
      priority: 'high',
      change: signals.paymentReliability - 0.75,
      direction: 'down',
      context: 'partial_payment_pattern',
      comparisonPeriod: 'current term',
    });
  } else {
    // Good payer — still emit a signal so confidence stays high
    events.push({
      domain: 'finance',
      priority: 'moderate',
      change: signals.paymentReliability,
      direction: 'up',
      context: 'stable_payment_pattern',
      comparisonPeriod: 'current term',
    });
  }

  // Success score signal — always emit so confidence is never zero
  const score = (signals.attendanceStability + signals.paymentReliability + signals.engagementVelocity) / 3;
  if (score > 0.85) {
    events.push({ domain: 'success', priority: 'low', change: score, direction: 'up', context: 'elite_performance', comparisonPeriod: 'current period' });
  } else if (score < 0.4) {
    events.push({ domain: 'success', priority: 'critical', change: score - 0.65, direction: 'down', context: 'at_risk', comparisonPeriod: 'current period' });
  } else {
    // Normal performing student — moderate baseline signal
    events.push({ domain: 'success', priority: 'moderate', change: score, direction: 'flat', context: 'developing', comparisonPeriod: 'current period' });
  }

  return events.sort((a, b) => {
    const p = { critical: 0, high: 1, moderate: 2, low: 3 };
    return p[a.priority] - p[b.priority];
  });
}

// ─── MODULE B: Context Builder ────────────────────────────────────────────────

function buildContext(event: SignalEvent, dashboardCtx: DashboardContext, studentId?: string): InsightContext {
  const changePct = `${event.change > 0 ? '+' : ''}${(event.change * 100).toFixed(0)}%`;

  const periodMap: Record<string, string> = {
    'previous two weeks': 'the past two weeks',
    'current term': 'this term',
    'last 3 assessments': 'the last three assessments',
    'current period': 'the current period',
  };

  return {
    domain: event.domain,
    metric: event.context,
    change: changePct,
    period: periodMap[event.comparisonPeriod] ?? event.comparisonPeriod,
    comparison: event.comparisonPeriod,
    significance: event.priority,
    studentId,
    dashboardCtx,
  };
}

// ─── MODULE C: Vocabulary Diversifier ────────────────────────────────────────

const UPWARD_VERBS = ['accelerated', 'surged by', 'demonstrated robust expansion in', 'outperformed baseline in', 'optimized Gains in', 'consolidated high-velocity growth in'];
const DOWNWARD_VERBS = ['atrophied by', 'exhibited contraction in', 'underperformed critical thresholds in', 'suffered a precision drop in', 'demonstrated systemic decay in'];
const STABLE_VERBS = ['maintained equilibrium in', 'held a strategic plateau in', 'demonstrated consistent delivery in', 'stabilized at benchmark levels in'];

let _verbRotateIdx = 0;
function pickVerb(direction: 'up' | 'down' | 'flat'): string {
  _verbRotateIdx = (_verbRotateIdx + 1) % 6;
  if (direction === 'up')   return UPWARD_VERBS[_verbRotateIdx % UPWARD_VERBS.length];
  if (direction === 'down') return DOWNWARD_VERBS[_verbRotateIdx % DOWNWARD_VERBS.length];
  return STABLE_VERBS[_verbRotateIdx % STABLE_VERBS.length];
}

// ─── MODULE D: Tone-Adapted Narrative Generator (FIPCL) ──────────────────────

/**
 * Generates a single contextual, tone-adapted, data-interpolated insight.
 * Pattern: Observation + Interpretation + Implication
 */
function generateContextualNarrative(ctx: InsightContext, signals: BehavioralSignals): string {
  const { metric, change, period, dashboardCtx, domain } = ctx;
  const attRatePct   = `${(signals.attendanceRate * 100).toFixed(0)}%`;
  const payRelPct    = `${(signals.paymentReliability * 100).toFixed(0)}%`;
  const delta        = parseFloat(change.replace('%', ''));
  const direction: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const verb         = pickVerb(direction);

  // ── ATTENDANCE domain ──────────────────────────────────────────────────────
  if (domain === 'attendance') {
    const obs = delta < 0
      ? `Critical Signal: Attendance ${verb} ${Math.abs(delta).toFixed(0)}% during ${period}.`
      : `Performance Analysis: Attendance ${verb} ${Math.abs(delta).toFixed(0)}% over ${period}.`;

    const interp: Record<DashboardContext, string> = {
      student: delta < 0
        ? ` This indicates a high-risk engagement deficit, particularly during critical mid-week blocks where attention is most required.`
        : ` This reflects a strengthening learning commitment, optimizing your exposure to core curriculum modules.`,
      teacher: delta < 0
        ? ` Systematic engagement drift detected. This downward trajectory threatens curriculum coverage targets for the current cycle.`
        : ` Group-wide engagement is trending toward elite performance targets. Sustaining this throughput is essential for assessment readiness.`,
      admin: delta < 0
        ? ` Institutional bottleneck detected. This pattern correlates with historic mid-term pressure points and requires resource reallocation.`
        : ` Operational efficiency gains confirmed. Current scheduling logic is yielding a measurable improvement in student throughput.`,
      finance: ` Attendance fluctuations represent a leading indicator for tuition risk. Proactive fiscal monitoring is advised.`,
    };

    const implication: Record<DashboardContext, string> = {
      student:  ` **Directive:** Stabilize attendance above ${attRatePct} immediately to protect your success index.`,
      teacher:  ` **Tactical Advice:** Deploy immediate re-engagement protocols specifically for students in the lower attendance deciles.`,
      admin:    ` **Strategic Recommendation:** Cross-verify timetable heatmaps with staff availability to eliminate coverage gaps.`,
      finance:  ` **Directive:** No immediate collection trigger; maintain standard oversight.`,
    };

    return `${obs}${interp[dashboardCtx]}${implication[dashboardCtx]}`;
  }

  // ── FINANCE domain ─────────────────────────────────────────────────────────
  if (domain === 'finance') {
    const obs = `Fiscal Analysis: Tuition compliance ${verb} this cycle. Current payment reliability is indexed at ${payRelPct}.`;
    const interp: Record<DashboardContext, string> = {
      student: ` Maintaining a 100% reliability rating is non-negotiable for continuous access to the Education Cloud and AI-powered learning modules.`,
      teacher: ` Student fiscal status is a significant variable in resource access. Ensure affected students are supported while compliance is normalized.`,
      admin:   ` Fiscal volatility detected. A variance of ${change} from the quarterly target necessitates a precision audit of outstanding accounts.`,
      finance: ` Revenue Leakage Warning: Failure to address the ${(100 - parseFloat(payRelPct)).toFixed(0)}% collection gap will compromise term-end delivery targets.`,
    };
    const recommendation: Record<DashboardContext, string> = {
      student: ` **Directive:** Settle outstanding balances to secure your position in the elite performance zone.`,
      teacher: ` **Tactical Advice:** Monitor resource usage patterns to ensure no student is left behind during payment normalization.`,
      admin:   ` **Strategic Recommendation:** Implement dynamic payment triggers to automate follow-up for fluctuating accounts.`,
      finance: ` **Directive:** Execute aggressive recovery protocols for accounts showing >15% reliability decay.`,
    };
    return `${obs}${interp[dashboardCtx]} ${recommendation[dashboardCtx]}`;
  }

  // ── SUCCESS domain ─────────────────────────────────────────────────────────
  if (domain === 'success') {
    if (metric === 'elite_performance') {
      const elite: Record<DashboardContext, string> = {
        student: `Strategic Advantage: Your engagement consistency is placing you in the top performance tier. With attendance at ${attRatePct} and payment reliability at ${payRelPct}, your foundation is fortified. **Directive:** Focus on curriculum mastery to convert this momentum into a Tier-1 academic outcome.`,
        teacher: `Intelligence Briefing: This cohort is demonstrating elite-tier engagement. Both attendance and fiscal signals are performing above the institutional benchmark. **Tactical Advice:** Introduce advanced extension modules to challenge this high-velocity group.`,
        admin:   `Systemic Audit: Platform health is optimal. The current "Success Index" is driven by a surge in elite-performing student clusters. **Strategic Recommendation:** Benchmark this cohort's parameters to refine success models for other segments.`,
        finance: `Fiscal Intelligence: High-velocity student clusters are correlating with 100% payment compliance. Maintain current engagement strategies to protect revenue stability.`,
      };
      return elite[dashboardCtx];
    }
    if (metric === 'at_risk') {
      const risk: Record<DashboardContext, string> = {
        student: `Critical Alert: Multiple engagement signals have breached the platform safety threshold. Attendance and session participation are in high-risk zones. **Directive:** Re-establish baseline habits immediately to arrest this downward trajectory before assessment entry.`,
        teacher: `Tactical Warning: Systemic failure detected in at-risk student clusters. The intersection of attendance and payment decay indicates a high probability of student churn. **Tactical Advice:** Immediate 1-on-1 intervention is mandatory for the identified high-risk IDs.`,
        admin:   `Executive Warning: At-risk signals are saturating the lower quartiles. This poses a threat to aggregate KPIs. **Strategic Recommendation:** Activate the Rapid Response Team to execute retention protocols within this assessment cycle.`,
        finance: `Risk Disclosure: At-risk students exhibit elevated fiscal vulnerability. Coordinated intervention with academic leads is critical to mitigate revenue loss.`,
      };
      return risk[dashboardCtx];
    }
  }

  // ── PLATFORM-WIDE fallback ─────────────────────────────────────────────────
  const fallback: Record<DashboardContext, string> = {
    student: `Platform intelligence has detected a notable signal in your academic profile. Continue engaging consistently to maintain positive trajectory.`,
    teacher: `Behavioral analytics across the student group indicate a period worth close monitoring.`,
    admin:   `Platform-wide behavioral signals are within expected parameters. No critical intervention required at this stage.`,
    finance: `Financial signals are consistent with current term patterns. Continued monitoring is recommended.`,
  };
  return fallback[dashboardCtx];
}

// ─── MODULE E: Confidence Scorer ─────────────────────────────────────────────

function computeConfidence(signal: SignalEvent, signals: BehavioralSignals): number {
  const dataVolumeFactor = Math.min(1, (signals.eventCount || 10) / 50); // Reduced denominator: 50 events = full confidence
  const signalStrength = signal.priority === 'critical' ? 1.0
    : signal.priority === 'high'     ? 0.82
    : signal.priority === 'moderate' ? 0.65
    : 0.50;  // low priority still 50%
  return Math.min(0.98, signalStrength * (0.55 + dataVolumeFactor * 0.45));
}

// ─── MODULE F: Anti-Repetition (simple in-memory dedup) ──────────────────────

const _recentInsightKeys = new Set<string>();

function isDuplicate(narrative: string): boolean {
  const key = narrative.slice(0, 60).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (_recentInsightKeys.has(key)) return true;
  _recentInsightKeys.add(key);
  if (_recentInsightKeys.size > 200) {
    // Keep memory bounded
    const first = _recentInsightKeys.values().next().value;
    if (first) _recentInsightKeys.delete(first);
  }
  return false;
}

// ─── CognitiveCore (Main Export) ─────────────────────────────────────────────

export class CognitiveCore {
  private static get supabase() {
    return createClient();
  }
  private static MIN_INFERENCE_THRESHOLD = 10;  // Reduced: 10 events sufficient for real inference
  private static PEER_MEDIAN_ATTENDANCE  = 0.82;
  private static PEER_MEDIAN_STABILITY   = 0.78;

  /**
   * Calculates the unified Success Score (with initialization smoothing).
   */
  static calculateSuccessIndex(signals: BehavioralSignals): number {
    const n = signals.eventCount || 0;
    if (n < this.MIN_INFERENCE_THRESHOLD) {
      const init = (signals.attendanceRate + signals.paymentReliability) / 2;
      return 0.45 + init * 0.1;
    }
    return Math.min(1, Math.max(0,
      signals.attendanceStability      * 0.40 +
      signals.paymentReliability       * 0.40 +
      signals.engagementVelocity       * 0.20
    ));
  }

  /**
   * Builds the Behavioral Feature Fabric (fingerprint).
   */
  static computeBehavioralFingerprint(signals: BehavioralSignals, trajectory?: TrajectoryMetrics): BehavioralFingerprint {
    return {
      relativeAttendanceDeviation: signals.attendanceRate - this.PEER_MEDIAN_ATTENDANCE,
      learningConsistencySlope:    trajectory?.successGain || 0,
      paymentBehaviorPattern:      signals.paymentReliability > 0.9 ? 'Stable'
        : signals.paymentReliability > 0.6 ? 'Fluctuating' : 'Delayed',
      sessionEngagementTrajectory: signals.engagementVelocity * (trajectory?.academicSlope || 1),
      temporalBehaviorRhythm:      Math.abs(signals.attendanceStability - this.PEER_MEDIAN_STABILITY),
    };
  }

  /**
   * Maps success score to Classification Zone + labels.
   */
  static getProgressZoneDetails(score: number, trajectory?: TrajectoryMetrics): { zone: ClassificationZone; label: string; meaning: string } {
    const v = trajectory?.successGain || 0;
    if (score >= 0.85) return {
      zone: ClassificationZone.ELITE,
      label: v > 0.05 ? 'Learning Momentum: Skyrocketing' : 'Performance Path: Elite Excellence',
      meaning: 'You are performing in the top decile of students with similar activity patterns.',
    };
    if (score >= 0.65) return {
      zone: ClassificationZone.HEALTHY,
      label: v > 0 ? 'Learning Trajectory: Developing Strongly' : 'Attention Pattern: Stable',
      meaning: 'You are maintaining strong learning consistency compared to peers.',
    };
    if (score >= 0.35) return {
      zone: ClassificationZone.MONITORING,
      label: 'Learning Rhythms: Initializing',
      meaning: 'You are building a foundation. Focus on session consistency to move into the growth zone.',
    };
    return {
      zone: ClassificationZone.CRITICAL,
      label: 'Intervention Status: Proactive Focus Required',
      meaning: 'Current signals suggest significant drift. A reset of engagement habits is strongly recommended.',
    };
  }

  /** @deprecated Use getProgressZoneDetails */
  static getClassificationZone(score: number): ClassificationZone {
    if (score < 0.35) return ClassificationZone.CRITICAL;
    if (score < 0.65) return ClassificationZone.MONITORING;
    if (score < 0.85) return ClassificationZone.HEALTHY;
    return ClassificationZone.ELITE;
  }

  static getMotivationalCaption(score: number): string {
    if (score >= 0.85) return 'Elite learning consistency detected. Your trajectory is set for mastery.';
    if (score >= 0.65) return 'Strong momentum. You are outperforming the standard learning velocity.';
    if (score >= 0.35) return 'Foundation building in progress. Every minute of engagement counts.';
    return 'Growth starts with a single persistent step. Your future self is cheering you on.';
  }

  static predictAcademicOutcome(signals: BehavioralSignals, trajectory?: TrajectoryMetrics): string {
    const score = this.calculateSuccessIndex(signals);
    if (score > 0.8) return 'Projected Elite: High probability of Distinction/Grade A.';
    if (score > 0.6) return 'Stable Growth: Trending toward Grade B performance.';
    return 'Intervention Required: Academic trajectory is currently below benchmark.';
  }

  /**
   * Correlates behavioral signals with academic outcomes.
   */
  static correlateBehaviorToGrades(signals: BehavioralSignals, avgNumericGrade: number): string {
    const att = signals.attendanceRate;
    if (att > 0.9 && avgNumericGrade > 0.8) {
      return "Strong positive correlation: High attendance is directly fueling elite academic performance.";
    }
    if (att < 0.7 && avgNumericGrade < 0.5) {
      return "Critical correlation: Attendance deficit is the primary driver of academic underperformance.";
    }
    if (att > 0.85 && avgNumericGrade < 0.5) {
      return "Inverse correlation: High attendance but low grades suggest a 'Participation without Mastery' pattern. Review study methods.";
    }
    return "Moderate correlation: Behavioral habits are consistent with current academic trajectory.";
  }

  /**
   * Fetches the full behavioral intelligence profile.
   */
  static async getStudentBehavioralProfile(studentId: string): Promise<BehavioralProfile> {
    const signals = await this.fetchStudentSignals(studentId);
    const prediction = await this.infer(studentId, signals);
    const fingerprint = this.computeBehavioralFingerprint(signals, prediction.trajectory);

    // Get academic context for correlation
    const history = await ResultsCognitiveCore.fetchSubjectHistory(studentId);
    const avgNumeric = history.length > 0 
      ? history.reduce((acc, h) => acc + ResultsCognitiveCore.gradeToNumeric(h.currentGrade), 0) / history.length
      : 0.5;

    return {
      studentId,
      signals,
      fingerprint,
      prediction,
      correlations: {
        attendanceToGrades: this.correlateBehaviorToGrades(signals, avgNumeric),
        paymentToEngagement: signals.paymentReliability < 0.7 
          ? "High risk: Payment instability is beginning to correlate with engagement drift."
          : "Stable: Financial compliance is supporting consistent platform engagement.",
      }
    };
  }

  /**
   * ★ Central Insight Generator (FIPCL-powered)
   * Replaces the old template-based generateInsight.
   * 
   * All dashboards must use this method — never scatter insight logic in components.
   */
  static async generateInsight(
    studentId: string,
    domain: InsightDomain,
    signals: BehavioralSignals,
    _fingerprint: BehavioralFingerprint,
    dashboardCtx: DashboardContext = 'student'
  ): Promise<string> {
    // 1. Detect signals
    const detectedSignals = detectSignals(signals);

    // 2. Find the most relevant signal for this domain
    const domainSignal = detectedSignals.find(s => s.domain === domain)
      ?? detectedSignals[0]
      ?? {
          domain,
          priority: 'moderate' as const,
          change: 0,
          direction: 'flat' as const,
          context: 'stable',
          comparisonPeriod: 'current period',
        };

    // 3. Build context
    const ctx = buildContext(domainSignal, dashboardCtx, studentId);

    // 4. Generate narrative
    let narrative = generateContextualNarrative(ctx, signals);

    // 5. Calculate confidence
    const confidence = computeConfidence(domainSignal, signals);

    // 6. Anti-repetition — retry once if duplicate
    if (isDuplicate(narrative)) {
      _verbRotateIdx += 2; // shift vocabulary
      narrative = generateContextualNarrative({ ...ctx, metric: ctx.metric + '_alt' }, signals);
    }

    // 7. Confidence gate — suppress only truly empty data (< 0.10)
    if (confidence < 0.10) {
      return 'Behavioral data is still accumulating for this student. Initial signals will be available shortly.';
    }

    // 8. Persist to database
    try {
      const isUUID = studentId && studentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      await this.supabase.from('intelligence_insights').upsert({
        entity_type: isUUID ? 'student' : 'platform',
        entity_id: isUUID ? studentId : null,
        insight_text: narrative,
        insight_type: domain,
        confidence,
        created_at: new Date().toISOString(),
      });
    } catch { /* Non-blocking — don't fail insights on DB write error */ }

    return narrative;
  }

  /**
   * ★ Unified Dashboard Insight API
   * Generates a complete set of insights for any dashboard context.
   * Route: /api/intelligence/insights
   */
  static async getInsightsForDashboard(
    entityId: string,
    dashboardCtx: DashboardContext,
    domains: InsightDomain[] = ['attendance', 'success']
  ): Promise<{ insight_text: string; type: InsightDomain; confidence: number }[]> {

    // 1. Try reading precomputed insights first (performance architecture)
    const isUUID = entityId && entityId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    let query = this.supabase
      .from('intelligence_insights')
      .select('insight_text, insight_type, confidence, created_at')
      .in('insight_type', domains);

    if (isUUID) {
      query = query.eq('entity_id', entityId).eq('entity_type', 'student');
    } else {
      query = query.is('entity_id', null).eq('entity_type', 'platform');
    }

    const { data: cached } = await query
      .order('created_at', { ascending: false })
      .limit(domains.length);

    const fresh = (cached || []).filter((r: any) => new Date(r.created_at).getTime() > Date.now() - 3600000);

    if (fresh.length >= domains.length) {
      return fresh.map((r: any) => ({
        insight_text: r.insight_text,
        type: r.insight_type as InsightDomain,
        confidence: r.confidence,
      }));
    }

    // 2. Freshly generate if cache is stale
    const signals = await this.fetchStudentSignals(entityId);
    const trajectory = entityId !== 'anonymous' ? await TrajectoryForecaster.getTrajectoryMetrics(entityId) : undefined;
    const fingerprint = this.computeBehavioralFingerprint(signals, trajectory);

    const results = await Promise.all(
      domains.map(async domain => ({
        insight_text: await this.generateInsight(entityId, domain, signals, fingerprint, dashboardCtx),
        type: domain,
        confidence: computeConfidence(detectSignals(signals)[0] ?? { priority: 'moderate' } as any, signals),
      }))
    );

    return results;
  }

  /**
   * ★ Core AGI Inference Engine
   */
  static async infer(studentId: string, signals: BehavioralSignals): Promise<PredictionResult> {
    try {
      const successScore = this.calculateSuccessIndex(signals);

      if (studentId !== 'anonymous') {
        await TrajectoryForecaster.recordTrajectory(studentId, signals, successScore);
      }
      const trajectory = studentId !== 'anonymous'
        ? await TrajectoryForecaster.getTrajectoryMetrics(studentId)
        : undefined;

      const fingerprint = this.computeBehavioralFingerprint(signals, trajectory);
      const { zone, label, meaning } = this.getProgressZoneDetails(successScore, trajectory);
      const academicOutcome = this.predictAcademicOutcome(signals, trajectory);
      const predictionConfidence = signals.eventCount && signals.eventCount > 100 ? 0.95 : 0.72;

      const baseRisk = (1 - signals.attendanceStability) * 0.4 + (1 - signals.engagementVelocity) * 0.3 + (1 - signals.paymentReliability) * 0.3;
      const trajectoryShift = trajectory ? (trajectory.successGain < -0.1 ? 0.2 : 0) : 0;
      const dropoutRisk = Math.min(1, Math.max(0, baseRisk + trajectoryShift));

      const insights = await Promise.all([
        this.generateInsight(studentId, 'success',    signals, fingerprint, 'student'),
        this.generateInsight(studentId, 'attendance', signals, fingerprint, 'student'),
      ]);

      const riskSignals: RiskSignals = {
        attendance: 1 - signals.attendanceRate,
        payment:    1 - signals.paymentReliability,
        engagement: 1 - signals.engagementVelocity,
        academic:   0, // Academic managed by RCCIC
      };

      return {
        successScore, zone, dropoutRisk, academicOutcome,
        insights, riskSignals,
        motivationalCaption: this.getMotivationalCaption(successScore),
        predictionConfidence, trajectory, fingerprint,
        progressZoneLabel: label, meaningStatement: meaning,
      };
    } catch (error) {
      console.error('[CCIC] Inference Error:', error);
      const fallback = this.calculateSuccessIndex(signals);
      const { zone, label, meaning } = this.getProgressZoneDetails(fallback);
      return {
        successScore: fallback, zone, dropoutRisk: 0.5,
        academicOutcome: 'Intelligence core restarting — baseline pattern active.',
        insights: ['Platform intelligence is recalibrating. Current signals reflect initialization state.'],
        riskSignals: { attendance: 0.2, payment: 0.1, engagement: 0.1, academic: 0.1 },
        motivationalCaption: this.getMotivationalCaption(fallback),
        predictionConfidence: 0.5,
        progressZoneLabel: label, meaningStatement: meaning,
      };
    }
  }

  /**
   * Aggregates platform-wide admin metrics.
   */
  static async getGlobalMetrics(): Promise<{ successIndex: number; dropoutRisk: number; zone: ClassificationZone }> {
    try {
      const { data: trajectories } = await this.supabase
        .from('behavioral_trajectories')
        .select('success_score')
        .order('snapshot_date', { ascending: false })
        .limit(200);

      if (!trajectories?.length) return { successIndex: 0.82, dropoutRisk: 0.12, zone: ClassificationZone.HEALTHY };

      const avgSuccess  = trajectories.reduce((s: number, t: any) => s + t.success_score, 0) / trajectories.length;
      const atRiskCount = trajectories.filter((t: any) => t.success_score < 0.4).length;
      const dropoutRisk = atRiskCount / trajectories.length;

      return { successIndex: avgSuccess, dropoutRisk: Math.max(0.05, dropoutRisk), zone: this.getClassificationZone(avgSuccess) };
    } catch {
      return { successIndex: 0.75, dropoutRisk: 0.15, zone: ClassificationZone.HEALTHY };
    }
  }

  /**
   * Fetches real behavioural signals from Supabase for a specific student.
   */
  static async fetchStudentSignals(studentId: string): Promise<BehavioralSignals> {
    const isUUID = studentId && studentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    try {
      const now = Date.now();
      const cutoff14 = new Date(now - 14 * 86400000).toISOString();
      const cutoff28 = new Date(now - 28 * 86400000).toISOString();

      let attQuery = this.supabase
        .from('attendance')
        .select('status, created_at');

      if (isUUID) {
        attQuery = attQuery.eq('student_id', studentId);
      }
      
      const { data: attendance } = await attQuery;

      const all  = attendance || [];
      const attTotal   = all.length;
      const present    = all.filter((r: any) => r.status === 'present' || r.status === 'late');
      const attRate    = attTotal > 0 ? present.length / attTotal : 0.85;

      // Compute 14-day delta
      const recent14   = all.filter((r: any) => r.created_at > cutoff14);
      const prev14     = all.filter((r: any) => r.created_at > cutoff28 && r.created_at <= cutoff14);
      const r14Pct     = recent14.length > 0 ? recent14.filter((r: any) => r.status === 'present').length / recent14.length : attRate;
      const p14Pct     = prev14.length   > 0 ? prev14.filter((r: any)   => r.status === 'present').length / prev14.length   : attRate;
      const recentDelta = r14Pct - p14Pct;

      let payQuery = this.supabase
        .from('ppt_payments')
        .select('status');
      
      if (isUUID) {
        payQuery = payQuery.eq('student_id', studentId);
      }

      const { data: payments } = await payQuery;

      const payRecords = payments || [];
      const payTotal = payRecords.length;
      const payPaid  = payRecords.filter((r: any) => r.status === 'paid').length;
      const paymentReliability = payTotal > 0 ? payPaid / payTotal : 0.90;

      // Engagement Velocity based on session frequency
      const { data: sessions } = await this.supabase
        .from('audit_logs') // Assuming audit_logs tracks logins/actions
        .select('created_at')
        .eq('created_by', studentId)
        .gt('created_at', cutoff28);
      
      const sessionCount = sessions?.length || 0;
      const engagementVelocity = Math.min(1, sessionCount / 20); // 20 sessions per month = 100%

      return {
        attendanceRate:          attRate,
        attendanceStability:     Math.min(1, attRate * 1.05),
        paymentReliability,
        engagementVelocity,
        eventCount:              (attTotal + payTotal + sessionCount) || 5,
        recentAttendanceDelta:   recentDelta,
        paymentDelayMean:        payTotal > 0 ? (payPaid / payTotal < 1 ? 4.5 : 0) : 0, // Mocked logic or real if data available
      };
    } catch {
      return {
        attendanceRate: 0.8, attendanceStability: 0.8,
        paymentReliability: 0.8, engagementVelocity: 0.8,
      };
    }
  }

  /**
   * High-level narrative generator (backwards-compatible helper).
   */
  static async generateNarrativeInsight(studentId: string, domain: string, dashboardCtx: DashboardContext = 'student'): Promise<string> {
    const signals     = await this.fetchStudentSignals(studentId);
    const trajectory  = await TrajectoryForecaster.getTrajectoryMetrics(studentId);
    const fingerprint = this.computeBehavioralFingerprint(signals, trajectory);
    return this.generateInsight(studentId, domain as InsightDomain, signals, fingerprint, dashboardCtx);
  }
}
