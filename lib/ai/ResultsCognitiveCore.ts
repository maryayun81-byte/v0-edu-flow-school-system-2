/**
 * RCCIC – Results Cognitive Intelligence Core v2.0
 * -------------------------------------------------
 * Predictive Academic Intelligence Engine
 *
 * Intelligence Pipeline:
 *   Fetch Student Results → Fetch Historical Results → Fetch Exam Results
 *   → Build Student Context → Compute Subject Trends → Rank Strengths
 *   → Detect Risk Patterns → Generate Multi-Signal Insights (4-6 per student)
 *   → Persist with Cross-Student Uniqueness Guard → Update Dashboards
 */

import { createClient } from '@/lib/supabase/client';
import { BehavioralSignals, InsightDomain, DashboardContext } from './CognitiveCore';
import { TrajectoryMetrics, TrajectoryForecaster } from './TrajectoryForecaster';

const supabase = createClient();

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface StudentResult {
  id: string;
  student_id: string;
  event_id: string;
  subject_id: string;
  subject_name: string;
  grade: string;
  overall_grade: string;
  previous_overall_grade: string;
  submitted_at: string;
}

export interface ResultsMetrics {
  averageGradeNumeric: number;
  improvementDelta: number;
  improvementVelocity: number;
  subjectConsistency: number;
  subjectTrends: Record<string, 'improving' | 'stable' | 'declining'>;
  riskSignals: string[];
}

export interface SubjectHistory {
  subject: string;
  grades: string[];       // ordered oldest → newest
  events: string[];       // matching event names
  trend: 'improving' | 'stable' | 'declining';
  currentGrade: string;
  previousGrade: string | null;
}

export interface StudentContext {
  studentId: string;
  eventId: string;
  eventName: string;
  subjects: Record<string, string>;         // subject → current grade
  previousSubjects: Record<string, string>; // subject → previous grade
  overallGrade: string;
  previousOverallGrade: string;
  attendanceRate: number;
  examResults: Record<string, string>;      // subject → exam grade
  subjectHistory: SubjectHistory[];
}

export interface RCCICInsight {
  type: 'subject_performance' | 'overall_trend' | 'exam_comparison' | 'behavioral' | 'strength' | 'momentum' | 'risk';
  subject?: string;
  text: string;
}

export interface ClassAnalytics {
  totalStudents: number;
  strongStudents: number;     // overall grade A or B
  moderateStudents: number;   // overall grade C
  atRiskStudents: number;     // overall grade D or E
  subjectDifficulty: { subject: string; avgNumeric: number; difficulty: 'easy' | 'moderate' | 'difficult' }[];
  subjectComparison: { subject: string; improvement: number }[];
  topSubject: string;
  hardestSubject: string;
  classInsight: string;
}

export interface ReadinessResult {
  score: number;              // 0-100
  level: 'Low' | 'Moderate' | 'High' | 'Elite';
  confidence: number;         // 0-1
  factors: { label: string; value: number; weight: number }[];
  digitalTwin: {
    learningVelocity: 'Slow' | 'Steady' | 'High' | 'Elite';
    attentionZone: 'Critical' | 'Focus' | 'Mastery';
    cognitiveTrait: string;
    recommendedStrategy: string;
  };
}

// ─── Grade helpers ─────────────────────────────────────────────────────────────

export class ResultsCognitiveCore {

  static gradeToNumeric(grade: string): number {
    const map: Record<string, number> = {
      'A': 1.0, 'A-': 0.92, 'B+': 0.87, 'B': 0.80, 'B-': 0.75,
      'C+': 0.70, 'C': 0.65, 'C-': 0.60, 'D+': 0.55, 'D': 0.50,
      'D-': 0.45, 'E': 0.30, 'F': 0.10,
    };
    return map[grade?.toUpperCase()?.trim()] ?? 0.5;
  }

  static numericToGrade(value: number): string {
    if (value >= 0.95) return 'A';
    if (value >= 0.90) return 'A-';
    if (value >= 0.85) return 'B+';
    if (value >= 0.78) return 'B';
    if (value >= 0.72) return 'B-';
    if (value >= 0.67) return 'C+';
    if (value >= 0.62) return 'C';
    if (value >= 0.57) return 'C-';
    if (value >= 0.52) return 'D+';
    if (value >= 0.47) return 'D';
    if (value >= 0.42) return 'D-';
    return 'E';
  }

  static gradeDirection(prev: string, curr: string): 'improved' | 'declined' | 'stable' {
    const p = this.gradeToNumeric(prev);
    const c = this.gradeToNumeric(curr);
    if (c - p > 0.05) return 'improved';
    if (p - c > 0.05) return 'declined';
    return 'stable';
  }

  // Normalize text for hashing (deduplication)
  private static hashInsight(text: string): string {
    return text.substring(0, 80).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Simple Jaccard Similarity check for string comparison.
   * Helps ensure insights are not >0.85 similar.
   */
  static calculateSimilarity(s1: string, s2: string): number {
    const set1 = new Set(s1.toLowerCase().split(/\s+/));
    const set2 = new Set(s2.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  // ─── Event Sync ─────────────────────────────────────────────────────────────

  static async syncEventStatuses() {
    try {
      const { error } = await supabase.rpc('sync_tuition_event_status');
      if (error) throw error;
    } catch (error) {
      console.error('[RCCIC] Event Sync Error:', error);
    }
  }

  static async getActiveEvent() {
    const { data, error } = await supabase
      .from('tuition_events')
      .select('*')
      .eq('active_status', true)
      .maybeSingle();
    if (error) console.error('[RCCIC] Error fetching active event:', error);
    return data;
  }

  // ─── Data Fetchers ──────────────────────────────────────────────────────────

  /**
   * Fetch all student results across all events, ordered by event date.
   */
  static async fetchSubjectHistory(studentId: string): Promise<SubjectHistory[]> {
    const isUUID = this.isValidUUID(studentId);
    if (!isUUID) return [];

    const { data, error } = await supabase
      .from('student_results')
      .select(`
        *,
        tuition_events!inner(id, name, start_date)
      `)
      .eq('student_id', studentId)
      .order('tuition_events(start_date)', { ascending: true });

    if (error || !data || data.length === 0) return [];

    // Group by subject
    const subjectMap: Record<string, { grades: string[]; events: string[] }> = {};
    for (const r of data) {
      const name = r.subject_name || 'Unknown';
      if (!subjectMap[name]) subjectMap[name] = { grades: [], events: [] };
      subjectMap[name].grades.push(r.grade);
      subjectMap[name].events.push(r.tuition_events?.name || 'Event');
    }

    return Object.entries(subjectMap).map(([subject, { grades, events }]) => {
      const last = grades[grades.length - 1];
      const prev = grades.length >= 2 ? grades[grades.length - 2] : null;
      const currentN = this.gradeToNumeric(last);
      const firstN = this.gradeToNumeric(grades[0]);
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (grades.length >= 2) {
        const prevN = this.gradeToNumeric(grades[grades.length - 2]);
        if (currentN - prevN > 0.05) trend = 'improving';
        else if (prevN - currentN > 0.05) trend = 'declining';
      }
      return { subject, grades, events, trend, currentGrade: last, previousGrade: prev };
    });
  }

  /**
   * Fetch exam results from marks table for a student.
   */
  static async fetchExamResults(studentId: string): Promise<Record<string, string>> {
    const isUUID = this.isValidUUID(studentId);
    if (!isUUID) return {};

    const { data, error } = await supabase
      .from('marks')
      .select(`
        score, max_score,
        subjects!inner(name)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return {};

    const examGrades: Record<string, string> = {};
    const seen = new Set<string>();
    for (const m of data) {
      const subjectName = (m as any).subjects?.name || 'Unknown';
      if (seen.has(subjectName)) continue; // take most recent
      seen.add(subjectName);
      const pct = m.max_score > 0 ? (m.score / m.max_score) : 0;
      examGrades[subjectName] = this.numericToGrade(pct);
    }

    return examGrades;
  }

  /**
   * Build the full Student Intelligence Context for a specific event.
   */
  static async buildStudentContext(studentId: string, eventId: string): Promise<StudentContext | null> {
    const isUUID = this.isValidUUID(studentId);
    if (!isUUID) return null;

    // Fetch current event results
    const { data: currentResults } = await supabase
      .from('student_results')
      .select('*, tuition_events!inner(name)')
      .eq('student_id', studentId)
      .eq('event_id', eventId);

    if (!currentResults || currentResults.length === 0) return null;

    const eventName = (currentResults[0] as any).tuition_events?.name || 'Tuition Event';
    const overallGrade = currentResults[0].overall_grade;
    const previousOverallGrade = currentResults[0].previous_overall_grade || '';

    // Build subject maps
    const subjects: Record<string, string> = {};
    currentResults.forEach((r: any) => {
      subjects[r.subject_name || 'Unknown'] = r.grade;
    });

    // Fetch previous event results (get second most recent event)
    const { data: allEventResults } = await supabase
      .from('student_results')
      .select('*, tuition_events!inner(start_date)')
      .eq('student_id', studentId)
      .neq('event_id', eventId)
      .order('tuition_events(start_date)', { ascending: false })
      .limit(20);

    const previousSubjects: Record<string, string> = {};
    if (allEventResults && allEventResults.length > 0) {
      const prevEventId = allEventResults[0].event_id;
      const prevEventResults = allEventResults.filter((r: any) => r.event_id === prevEventId);
      prevEventResults.forEach((r: any) => {
        previousSubjects[r.subject_name || 'Unknown'] = r.grade;
      });
    }

    // Fetch behavioral signals
    const { data: attData } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId);
    const attTotal = attData?.length || 0;
    const attPresent = attData?.filter((a: any) => a.status === 'present' || a.status === 'late').length || 0;
    const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 85;

    // Fetch exam results
    const examResults = await this.fetchExamResults(studentId);

    // Fetch subject history
    const subjectHistory = await this.fetchSubjectHistory(studentId);

    return {
      studentId,
      eventId,
      eventName,
      subjects,
      previousSubjects,
      overallGrade,
      previousOverallGrade,
      attendanceRate,
      examResults,
      subjectHistory,
    };
  }

  /**
   * Fetch and calculate class-wide analytics for an event + class.
   */
  static async fetchClassAnalytics(formClass: string, eventId: string): Promise<ClassAnalytics | null> {
    const { data: results, error } = await supabase
      .from('student_results')
      .select(`
        *,
        profiles!inner(full_name, form_class)
      `)
      .eq('event_id', eventId)
      .ilike('profiles.form_class', formClass);

    if (error || !results || results.length === 0) return null;

    // 1. Basic counts
    const uniqueStudents = new Set(results.map((r: any) => r.student_id));
    const totalStudents = uniqueStudents.size;

    // 2. Performance segments (using overall_grade from results)
    const overallGrades = results.map((r: any) => r.overall_grade);
    const numericGrades = overallGrades.map((g: string) => this.gradeToNumeric(g));

    const strong = numericGrades.filter((n: number) => n >= 0.75).length; // B- and above
    const moderate = numericGrades.filter((n: number) => n >= 0.60 && n < 0.75).length; // C- to B
    const atRisk = numericGrades.filter((n: number) => n < 0.60).length; // Below C-

    // 3. Subject-specific averages
    const subjectMap: Record<string, number[]> = {};
    results.forEach((r: any) => {
      const s = r.subject_name || 'General';
      if (!subjectMap[s]) subjectMap[s] = [];
      subjectMap[s].push(this.gradeToNumeric(r.grade));
    });

    const subjectDifficulty = Object.entries(subjectMap).map(([subject, grades]) => {
      const avg = grades.reduce((a: number, b: number) => a + b, 0) / grades.length;
      return {
        subject,
        avgNumeric: avg,
        difficulty: avg > 0.8 ? 'easy' : avg > 0.6 ? 'moderate' : 'difficult' as any
      };
    });

    // 4. Sort subjects
    const sortedSubjects = [...subjectDifficulty].sort((a, b) => b.avgNumeric - a.avgNumeric);
    const topSubject = sortedSubjects[0]?.subject || 'N/A';
    const hardestSubject = sortedSubjects[sortedSubjects.length - 1]?.subject || 'N/A';

    // 5. Comparison to previous event (if any exists)
    // We'd need previous event results to do the "Mathematics improved by 12%" logic.
    // Simplifying: we check if results have 'previous_overall_grade'
    let improvementInsight = '';
    const avgCurrent = numericGrades.reduce((a: number, b: number) => a + b, 0) / (numericGrades.length || 1);
    const prevGrades = results.map((r: any) => this.gradeToNumeric(r.previous_overall_grade)).filter((n: number) => n > 0);
    const avgPrev = prevGrades.length > 0 ? prevGrades.reduce((a: number, b: number) => a + b, 0) / prevGrades.length : 0;
    
    if (avgPrev > 0) {
      const delta = ((avgCurrent - avgPrev) / avgPrev) * 100;
      improvementInsight = `Overall class performance ${delta > 0 ? 'improved' : 'shifted'} by ${Math.abs(delta).toFixed(1)}%.`;
    }

    const prevAvgMap: Record<string, number[]> = {};
    results.forEach((r: any) => {
      const s = r.subject_name || 'General';
      const prevG = r.previous_grade; // Should check if this exists in schema or if we need to fetch it
      if (prevG) {
        if (!prevAvgMap[s]) prevAvgMap[s] = [];
        prevAvgMap[s].push(this.gradeToNumeric(prevG));
      }
    });

    const subjectComparison = Object.entries(subjectMap).map(([subject, grades]) => {
      const currentAvg = grades.reduce((a: number, b: number) => a + b, 0) / grades.length;
      const prevGrades = prevAvgMap[subject];
      if (prevGrades && prevGrades.length > 0) {
        const prevAvg = prevGrades.reduce((a: number, b: number) => a + b, 0) / prevGrades.length;
        return { subject, improvement: ((currentAvg - prevAvg) / (prevAvg || 1)) * 100 };
      }
      return { subject, improvement: 0 };
    });

    const classInsight = `${totalStudents} students in ${formClass} have submitted results. ${Math.round((strong/totalStudents)*100)}% of students are in the high-mastery zone. ${improvementInsight}`;

    return {
      totalStudents,
      strongStudents: strong,
      moderateStudents: moderate,
      atRiskStudents: atRisk,
      subjectDifficulty,
      subjectComparison,
      topSubject,
      hardestSubject,
      classInsight
    };
  }

  /**
   * Fetch progression data for a student: Subject-wise scores across events.
   * Compares Tuition vs Exams.
   */
  static async fetchProgressionData(studentId: string) {
    const tuitionHistory = await this.fetchSubjectHistory(studentId);
    const examResults = await this.fetchExamResults(studentId); // This only gets recent. Need historical.
    
    // For now, mapping history
    return tuitionHistory.map(th => ({
      subject: th.subject,
      tuition: th.grades.map(g => this.gradeToNumeric(g)),
      exam: examResults[th.subject] ? this.gradeToNumeric(examResults[th.subject]) : null,
      events: th.events
    }));
  }

  // ─── Insight Generation Engine ───────────────────────────────────────────────

  private static readonly SUBJECT_IMPROVEMENT_TEMPLATES = [
    (subject: string, prev: string, curr: string, event: string) =>
      `${subject} improved from grade ${prev} to grade ${curr} in the ${event}, indicating strong academic growth.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `During ${event}, your ${subject} score increased from grade ${prev} to grade ${curr}, reflecting meaningful progress.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `Performance in ${subject} rose from grade ${prev} to ${curr} compared with the previous tuition event — a clear sign of improving mastery.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `${subject} demonstrated significant growth, advancing from grade ${prev} to ${curr} in the ${event}.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `A positive trajectory was identified in ${subject}, with gains bringing you from grade ${prev} to ${curr} during ${event}.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `The recent ${event} results show ${subject} moving from ${prev} to ${curr}, validating your current study habits.`,
  ];

  private static readonly SUBJECT_DECLINE_TEMPLATES = [
    (subject: string, prev: string, curr: string, event: string) =>
      `${subject} declined from grade ${prev} to grade ${curr} in the ${event}, suggesting recent topics may require additional focus.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `During ${event}, ${subject} performance dropped from grade ${prev} to grade ${curr}. Targeted revision is recommended.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `Performance in ${subject} fell from grade ${prev} to ${curr} compared with the previous tuition event.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `${subject} showed a decline this event, moving from grade ${prev} to ${curr}. Consistent practice may restore the previous trajectory.`,
    (subject: string, prev: string, curr: string, event: string) =>
      `Numerical signals indicate a minor drift in ${subject} from ${prev} to ${curr} in ${event}. Refocusing on core concepts is tactical.`,
  ];

  private static readonly SUBJECT_STABLE_TEMPLATES = [
    (subject: string, grade: string, event: string) =>
      `${subject} performance remained stable at grade ${grade} in the ${event}, demonstrating consistent understanding.`,
    (subject: string, grade: string, event: string) =>
      `During ${event}, ${subject} held steady at grade ${grade}, reflecting reliable subject mastery.`,
    (subject: string, grade: string, event: string) =>
      `${subject} has been consistent at grade ${grade}, maintaining a solid academic baseline.`,
    (subject: string, grade: string, event: string) =>
      `Evaluation of the ${event} shows ${subject} maintaining a stabilized grade of ${grade}.`,
  ];

  private static readonly NARRATIVE_VARIATIONS = [
    "This tactical shift is essential for long-term outcome reinforcement.",
    "Data patterns suggest this is a pivotal moment in your academic trajectory.",
    "RCCIC identifies this as a signature performance signal for this term.",
    "Maintaining this velocity will significantly enhance your Success Index.",
    "Current engagement trends correlate strongly with this specific outcome.",
    "Cognitive core analysis suggests high confidence in this performance baseline.",
    "This result mirrors the broader class performance curve for high-velocity learners.",
  ];

  private static _templateRotate = 0;
  private static _variationRotate = 0;

  private static pickTemplate<T extends (...args: any[]) => string>(templates: T[]): T {
    this._templateRotate = (this._templateRotate + Math.floor(Math.random() * 3) + 1) % templates.length;
    return templates[this._templateRotate];
  }

  private static pickVariation(): string {
    this._variationRotate = (this._variationRotate + 1) % this.NARRATIVE_VARIATIONS.length;
    return this.NARRATIVE_VARIATIONS[this._variationRotate];
  }

  /**
   * Generate 4-6 personalized multi-signal insights for a student.
   * Each insight references real grade values, subject names, and event context.
   */
  static async generateRCCICInsights(studentId: string, eventId: string): Promise<RCCICInsight[]> {
    const ctx = await this.buildStudentContext(studentId, eventId);
    if (!ctx) return [];

    const insights: RCCICInsight[] = [];

    // ── Signal 1: Subject Performance (per subject, anchored to real grade values) ──
    for (const [subject, currentGrade] of Object.entries(ctx.subjects)) {
      const previousGrade = ctx.previousSubjects[subject];
      if (!previousGrade) continue;

      const direction = this.gradeDirection(previousGrade, currentGrade);

      if (direction === 'improved') {
        const tpl = this.pickTemplate(this.SUBJECT_IMPROVEMENT_TEMPLATES);
        insights.push({
          type: 'subject_performance',
          subject,
          text: tpl(subject, previousGrade, currentGrade, ctx.eventName),
        });
      } else if (direction === 'declined') {
        const tpl = this.pickTemplate(this.SUBJECT_DECLINE_TEMPLATES);
        insights.push({
          type: 'subject_performance',
          subject,
          text: tpl(subject, previousGrade, currentGrade, ctx.eventName),
        });
      } else {
        const tpl = this.pickTemplate(this.SUBJECT_STABLE_TEMPLATES);
        insights.push({
          type: 'subject_performance',
          subject,
          text: tpl(subject, currentGrade, ctx.eventName),
        });
      }

      // Limit to 3 subject insights max to keep output focused
      if (insights.filter(i => i.type === 'subject_performance').length >= 3) break;
    }

    // ── Signal 2: Overall Grade Trend ──────────────────────────────────────────
    if (ctx.previousOverallGrade && ctx.overallGrade) {
      const dir = this.gradeDirection(ctx.previousOverallGrade, ctx.overallGrade);
      if (dir === 'improved') {
        insights.push({
          type: 'overall_trend',
          text: `Overall academic performance improved from grade ${ctx.previousOverallGrade} in the previous tuition event to grade ${ctx.overallGrade} in ${ctx.eventName}.`,
        });
      } else if (dir === 'declined') {
        insights.push({
          type: 'overall_trend',
          text: `Overall academic performance declined from grade ${ctx.previousOverallGrade} to grade ${ctx.overallGrade} in ${ctx.eventName}. Reviewing recent topics may help restore momentum.`,
        });
      } else {
        insights.push({
          type: 'overall_trend',
          text: `Overall academic performance remained stable at grade ${ctx.overallGrade} in ${ctx.eventName}, consistent with previous results.`,
        });
      }
    }

    // ── Signal 3: Tuition vs Exam Comparison ────────────────────────────────────
    const examSubjects = Object.keys(ctx.examResults);
    for (const subject of examSubjects) {
      const tuitionGrade = ctx.subjects[subject];
      const examGrade = ctx.examResults[subject];
      if (!tuitionGrade || !examGrade) continue;

      const tuitionN = this.gradeToNumeric(tuitionGrade);
      const examN = this.gradeToNumeric(examGrade);

      if (tuitionN - examN > 0.1) {
        insights.push({
          type: 'exam_comparison',
          subject,
          text: `${subject} tuition performance (grade ${tuitionGrade}) exceeds the internal exam result (grade ${examGrade}), suggesting strong understanding during guided tuition sessions.`,
        });
      } else if (examN - tuitionN > 0.1) {
        insights.push({
          type: 'exam_comparison',
          subject,
          text: `${subject} exam result (grade ${examGrade}) is stronger than the tuition submission (grade ${tuitionGrade}), indicating solid independent performance under exam conditions.`,
        });
      }
      break; // One exam comparison insight is sufficient
    }

    // ── Signal 4: Subject Strength Ranking ─────────────────────────────────────
    const subjectEntries = Object.entries(ctx.subjects);
    if (subjectEntries.length > 0) {
      const sorted = [...subjectEntries].sort(
        ([, a], [, b]) => this.gradeToNumeric(b) - this.gradeToNumeric(a)
      );
      const [topSubject, topGrade] = sorted[0];
      const historyForTop = ctx.subjectHistory.find(h => h.subject === topSubject);
      if (historyForTop && historyForTop.grades.length >= 2) {
        insights.push({
          type: 'strength',
          subject: topSubject,
          text: `${topSubject} remains the strongest performing subject with grade ${topGrade}, showing consistent high performance across multiple tuition events.`,
        });
      } else {
        insights.push({
          type: 'strength',
          subject: topSubject,
          text: `${topSubject} currently stands as the top subject with grade ${topGrade} in ${ctx.eventName}.`,
        });
      }
    }

    // ── Signal 5: Academic Momentum (multi-event trend) ─────────────────────────
    for (const history of ctx.subjectHistory) {
      if (history.grades.length >= 3) {
        const first = this.gradeToNumeric(history.grades[0]);
        const last = this.gradeToNumeric(history.grades[history.grades.length - 1]);
        if (last - first > 0.15) {
          insights.push({
            type: 'momentum',
            subject: history.subject,
            text: `${history.subject} performance has improved steadily across ${history.grades.length} tuition events — from grade ${history.grades[0]} to ${history.grades[history.grades.length - 1]} — indicating strong academic momentum.`,
          });
          break;
        }
      }
    }

    // ── Signal 6: Behavioral / Attendance Correlation ───────────────────────────
    if (ctx.attendanceRate >= 85) {
      const improvingSubjects = Object.entries(ctx.subjects)
        .filter(([subj]) => {
          const prev = ctx.previousSubjects[subj];
          if (!prev) return false;
          return this.gradeDirection(prev, ctx.subjects[subj]) === 'improved';
        })
        .map(([s]) => s);

      if (improvingSubjects.length > 0) {
        insights.push({
          type: 'behavioral',
          text: `Consistent attendance of ${ctx.attendanceRate}% during ${ctx.eventName} coincides with improved performance in ${improvingSubjects.slice(0, 2).join(' and ')}, reinforcing the value of regular participation.`,
        });
      } else {
        insights.push({
          type: 'behavioral',
          text: `With an attendance rate of ${ctx.attendanceRate}% in ${ctx.eventName}, consistent engagement provides a strong foundation for academic improvement.`,
        });
      }
    } else if (ctx.attendanceRate < 75) {
      insights.push({
        type: 'behavioral',
        text: `Attendance of ${ctx.attendanceRate}% during ${ctx.eventName} is below the recommended threshold. Increasing session participation is likely to positively impact academic outcomes.`,
      });
    }

    // ── Signal 7: Subject Difficulty Sensitivity (New in 2.0) ───────────────────
    const classAnalytics = await this.generateClassAnalytics(eventId);
    if (classAnalytics.totalStudents > 0) {
        const hardestSubj = classAnalytics.hardestSubject;
        const studentGradeInHardest = ctx.subjects[hardestSubj];
        if (studentGradeInHardest) {
            const numericInHardest = this.gradeToNumeric(studentGradeInHardest);
            if (numericInHardest >= 0.70) {
                insights.push({
                    type: 'momentum',
                    subject: hardestSubj,
                    text: `Performance in ${hardestSubj} (grade ${studentGradeInHardest}) is highly competitive, especially as RCCIC identifies this as the most difficult module class-wide this event.`
                });
            }
        }
    }

    // Append professional variation to a subset of insights for ultimate uniqueness
    insights.forEach((insight, idx) => {
        if (idx % 2 === 0) {
            insight.text += ' ' + this.pickVariation();
        }
    });

    // Limit to max 6 insights
    return insights.slice(0, 6);
  }

  /**
   * Detect academic risk patterns and return risk signals.
   */
  static async detectRiskPatterns(studentId: string): Promise<string[]> {
    const history = await this.fetchSubjectHistory(studentId);
    const risks: string[] = [];

    for (const subj of history) {
      if (subj.grades.length >= 3) {
        const last3 = subj.grades.slice(-3);
        const n0 = this.gradeToNumeric(last3[0]);
        const n1 = this.gradeToNumeric(last3[1]);
        const n2 = this.gradeToNumeric(last3[2]);
        if (n0 > n1 && n1 > n2) {
          risks.push(`${subj.subject} has declined across three consecutive tuition events, from grade ${last3[0]} to ${last3[2]}. Targeted intervention is recommended.`);
        }
      } else if (subj.grades.length === 2) {
        const n0 = this.gradeToNumeric(subj.grades[0]);
        const n1 = this.gradeToNumeric(subj.grades[1]);
        if (n0 - n1 > 0.15) {
          risks.push(`${subj.subject} showed a significant drop from grade ${subj.grades[0]} to ${subj.grades[1]}.`);
        }
      }
    }

    return risks;
  }

  /**
   * Predict future grade for a specific subject using linear trend extrapolation.
   */
  static predictFutureGrade(history: SubjectHistory): { predictedGrade: string; confidence: number } {
    const grades = history.grades;
    if (grades.length < 2) {
      return { predictedGrade: grades[grades.length - 1] || 'C', confidence: 0.5 };
    }

    const numerics = grades.map(g => this.gradeToNumeric(g));
    const n = numerics.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = numerics.reduce((a, b) => a + b, 0);
    const sumXY = numerics.reduce((acc, y, x) => acc + x * y, 0);
    const sumX2 = numerics.reduce((acc, _, x) => acc + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const predicted = Math.min(1.0, Math.max(0.1, intercept + slope * n));

    const confidence = Math.min(0.95, 0.5 + n * 0.08);
    return { predictedGrade: this.numericToGrade(predicted), confidence };
  }

  /**
   * Class-level analytics for teacher dashboard.
   */
  static async generateClassAnalytics(eventId: string): Promise<ClassAnalytics> {
    const { data: results } = await supabase
      .from('student_results')
      .select('student_id, overall_grade, subject_name, grade')
      .eq('event_id', eventId);

    if (!results || results.length === 0) {
      return {
        totalStudents: 0,
        strongStudents: 0,
        moderateStudents: 0,
        atRiskStudents: 0,
        subjectDifficulty: [],
        subjectComparison: [],
        topSubject: 'N/A',
        hardestSubject: 'N/A',
        classInsight: 'No results available for this event.',
      };
    }

    // Unique students by overall grade
    const studentGrades = new Map<string, string>();
    const subjectGrades: Record<string, number[]> = {};

    for (const r of results) {
      if (!studentGrades.has(r.student_id)) {
        studentGrades.set(r.student_id, r.overall_grade);
      }
      if (r.subject_name && r.grade) {
        if (!subjectGrades[r.subject_name]) subjectGrades[r.subject_name] = [];
        subjectGrades[r.subject_name].push(this.gradeToNumeric(r.grade));
      }
    }

    const totalStudents = studentGrades.size;
    let strongStudents = 0, moderateStudents = 0, atRiskStudents = 0;

    studentGrades.forEach(grade => {
      const n = this.gradeToNumeric(grade);
      if (n >= 0.78) strongStudents++;
      else if (n >= 0.60) moderateStudents++;
      else atRiskStudents++;
    });

    // Subject difficulty analysis
    const subjectDifficulty = Object.entries(subjectGrades).map(([subject, nums]) => {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      return {
        subject,
        avgNumeric: avg,
        difficulty: avg >= 0.78 ? 'easy' as const : avg >= 0.60 ? 'moderate' as const : 'difficult' as const,
      };
    }).sort((a, b) => b.avgNumeric - a.avgNumeric);

    const topSubject = subjectDifficulty[0]?.subject || 'N/A';
    const hardestSubject = subjectDifficulty[subjectDifficulty.length - 1]?.subject || 'N/A';

    const strongPct = Math.round((strongStudents / totalStudents) * 100);
    const atRiskPct = Math.round((atRiskStudents / totalStudents) * 100);

    let classInsight = '';
    if (atRiskPct > 30) {
      classInsight = `${atRiskPct}% of students in this class are performing below the passing threshold. ${hardestSubject} shows the highest difficulty, with targeted intervention recommended for at-risk learners.`;
    } else if (strongPct > 60) {
      classInsight = `${strongPct}% of students achieved grade B or above in this event. ${topSubject} is the strongest performing subject across the class, with consistent high grades.`;
    } else {
      classInsight = `Class performance is mixed in this event, with ${strongPct}% of students performing strongly and ${atRiskPct}% requiring additional support. ${topSubject} leads in performance while ${hardestSubject} presents the greatest challenge.`;
    }

    return {
      totalStudents,
      strongStudents,
      moderateStudents,
      atRiskStudents,
      subjectDifficulty,
      subjectComparison: [], // Add dummy for now to legacy method
      topSubject,
      hardestSubject,
      classInsight,
    };
  }

  // ─── Success Index ───────────────────────────────────────────────────────────

  static computeSuccessIndex(signals: BehavioralSignals, results: ResultsMetrics): number {
    const behavioralScore =
      signals.attendanceStability * 0.4 +
      signals.paymentReliability * 0.4 +
      signals.engagementVelocity * 0.2;

    return (behavioralScore * 0.6) + (results.averageGradeNumeric * 0.4);
  }

  // ─── Cross-Event Performance Analysis (legacy compatible) ────────────────────

  static async analyzeCrossEventPerformance(studentId: string): Promise<ResultsMetrics> {
    const isUUID = this.isValidUUID(studentId);
    if (!isUUID) {
      return { averageGradeNumeric: 0.5, improvementDelta: 0, improvementVelocity: 0, subjectConsistency: 1, subjectTrends: {}, riskSignals: [] };
    }

    const { data: rawData, error } = await supabase
      .from('student_results')
      .select('*')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });

    if (error || !rawData || rawData.length === 0) {
      // Return more realistic defaults if no data exists yet to keep the twin "alive" but pending
      return { averageGradeNumeric: 0.65, improvementDelta: 0, improvementVelocity: 0.02, subjectConsistency: 0.85, subjectTrends: {}, riskSignals: [] };
    }

    const results = rawData as StudentResult[];
    const latest = results[0];
    const prevOverall = latest.previous_overall_grade ? this.gradeToNumeric(latest.previous_overall_grade) : 0;
    const currentOverall = this.gradeToNumeric(latest.overall_grade);
    const improvementDelta = currentOverall - prevOverall;

    const uniqueEvents = Array.from(new Set(results.map(r => r.event_id)));
    const improvementVelocity = uniqueEvents.length > 1
      ? (currentOverall - this.gradeToNumeric(results[results.length - 1].overall_grade)) / (uniqueEvents.length || 1)
      : improvementDelta;

    const latestEventResults = results.filter(r => r.event_id === latest.event_id);
    const grades = latestEventResults.map(r => this.gradeToNumeric(r.grade));
    const mean = grades.reduce((a, b) => a + b, 0) / (grades.length || 1);
    const variance = grades.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (grades.length || 1);
    const subjectConsistency = 1 - Math.sqrt(variance);

    const subjectMap: Record<string, string[]> = {};
    results.forEach(r => {
      const name = r.subject_name || 'Unknown';
      if (!subjectMap[name]) subjectMap[name] = [];
      subjectMap[name].push(r.grade);
    });

    const subjectTrends: Record<string, 'improving' | 'stable' | 'declining'> = {};
    Object.entries(subjectMap).forEach(([name, gs]) => {
      if (gs.length < 2) { subjectTrends[name] = 'stable'; return; }
      // gs is ordered newest first due to order('submitted_at', { ascending: false })
      const gLatest = this.gradeToNumeric(gs[0]);
      const gPrev = this.gradeToNumeric(gs[1]);
      subjectTrends[name] = gLatest > gPrev ? 'improving' : gLatest < gPrev ? 'declining' : 'stable';
    });

    const riskSignals = await this.detectRiskPatterns(studentId);

    return {
      averageGradeNumeric: currentOverall,
      improvementDelta,
      improvementVelocity,
      subjectConsistency,
      subjectTrends,
      riskSignals,
    };
  }

  /**
   * Calculate Academic Readiness Score (RCCIC God-Tier Logic)
   */
  static async calculateReadinessScore(studentId: string, eventId: string): Promise<ReadinessResult | null> {
    const ctx = await this.buildStudentContext(studentId, eventId);
    if (!ctx) return null;

    const metrics = await this.analyzeCrossEventPerformance(studentId);
    
    // 1. Grade Component (40%)
    const gradeScore = metrics.averageGradeNumeric * 100;
    
    // 2. Behavioral Component (25%)
    const attendanceScore = ctx.attendanceRate; // 0-100
    
    // 3. Growth Component (25%)
    // Improvement velocity (delta per event). Normalize -0.2 to 0.2 to 0-100
    const velocityScore = Math.min(100, Math.max(0, (metrics.improvementVelocity + 0.1) * 250));
    
    // 4. Consistency Component (10%)
    const consistencyScore = metrics.subjectConsistency * 100;

    // Weighted average
    const finalScore = Math.round(
      (gradeScore * 0.40) + 
      (attendanceScore * 0.25) + 
      (velocityScore * 0.25) + 
      (consistencyScore * 0.10)
    );

    const level = finalScore >= 85 ? 'Elite' : finalScore >= 70 ? 'High' : finalScore >= 50 ? 'Moderate' : 'Low';
    
    // Digital Twin Generation
    const digitalTwin = this.generateDigitalTwin(metrics, ctx);

    return {
      score: finalScore,
      level,
      confidence: 0.85 + (ctx.subjectHistory.length * 0.02),
      factors: [
        { label: 'Academic Proficiency', value: gradeScore, weight: 0.4 },
        { label: 'Session Engagement', value: attendanceScore, weight: 0.25 },
        { label: 'Improvement Velocity', value: velocityScore, weight: 0.25 },
        { label: 'Subject Consistency', value: consistencyScore, weight: 0.1 }
      ],
      digitalTwin
    };
  }

  private static generateDigitalTwin(metrics: ResultsMetrics, ctx: StudentContext) {
    const v = metrics.improvementVelocity;
    const learningVelocity: any = v > 0.08 ? 'Elite' : v > 0.03 ? 'High' : v > -0.02 ? 'Steady' : 'Slow';
    
    const avg = metrics.averageGradeNumeric;
    const attentionZone: any = avg < 0.5 ? 'Critical' : avg < 0.7 ? 'Focus' : 'Mastery';
    
    let cognitiveTrait = "Balanced Learner";
    if (metrics.subjectConsistency > 0.9) cognitiveTrait = "Consistent Performer";
    else if (v > 0.1) cognitiveTrait = "Fast Adaptor";
    else if (ctx.attendanceRate > 95 && avg < 0.6) cognitiveTrait = "Diligent Struggler";
    else if (avg > 0.85) cognitiveTrait = "Academic Pioneer";

    let recommendedStrategy = "Continue with current study patterns.";
    if (attentionZone === 'Critical') {
      recommendedStrategy = "Immediate 1-on-1 intervention required for core concepts.";
    } else if (learningVelocity === 'Slow') {
      recommendedStrategy = "Switch to visual learning aids and frequent active recall sessions.";
    } else if (cognitiveTrait === 'Fast Adaptor') {
      recommendedStrategy = "Introduce advanced problem-solving challenges to maintain momentum.";
    }

    return {
      learningVelocity,
      attentionZone,
      cognitiveTrait,
      recommendedStrategy
    };
  }

  // ─── Insight Persistence ─────────────────────────────────────────────────────

  /**
   * Persist insights and run cross-student deduplication.
   * Returns the final (potentially rephrased) insights array.
   */
  static async persistInsights(
    studentId: string,
    eventId: string,
    insights: RCCICInsight[]
  ): Promise<RCCICInsight[]> {
    const isUUID = this.isValidUUID(studentId);
    if (!isUUID) return insights;

    const finalInsights: RCCICInsight[] = [];

    for (const insight of insights) {
      const hash = this.hashInsight(insight.text);

      // Check cross-student registry — if this hash exists for a different student, rotate phrasing
      const { data: registryEntry } = await supabase
        .from('student_insight_registry')
        .select('student_id')
        .eq('insight_hash', hash)
        .maybeSingle();

      let finalText = insight.text;

      if (registryEntry && registryEntry.student_id !== studentId) {
        // Rotate phrasing by appending a context variation
        finalText = finalText + ' This trend is particularly notable in the context of the overall class performance this event.';
      }

      // Check own memory for duplicate
      const { data: myInsights } = await supabase
        .from('rccic_insights')
        .select('insight_hash')
        .eq('student_id', studentId)
        .eq('event_id', eventId);

      const myHashes = new Set((myInsights || []).map((i: any) => i.insight_hash));
      if (myHashes.has(hash)) {
        // Already persisted — skip but still return
        finalInsights.push({ ...insight, text: finalText });
        continue;
      }

      // Persist
      // 1. DEDUPLICATION: Check uniqueness across ALL students
      try {
        const { data: globalMatch } = await supabase
          .from('student_insight_registry')
          .select('student_id')
          .eq('insight_hash', hash)
          .limit(1);
        
        if (globalMatch && globalMatch.length > 0) continue; // Collision, skip this one
      } catch { /* Non-blocking uniqueness guard */ }

      // 2. SIMILARITY: Check if this student already received a very similar insight
      try {
        const { data: existing } = await supabase
          .from('rccic_insights')
          .select('insight_text')
          .eq('student_id', studentId)
          .limit(10);
        
        if (existing) {
          const isTooSimilar = existing.some((e: any) => this.calculateSimilarity(e.insight_text, finalText) > 0.85);
          if (isTooSimilar) continue; // Regenerate would be better, but skip is safer for now
        }
      } catch { /* Non-blocking similarity guard */ }

      // 3. PERSIST
      try {
        await supabase.from('rccic_insights').insert({
          student_id: studentId,
          event_id: eventId,
          insight_type: insight.type,
          subject: insight.subject || null,
          insight_text: finalText,
          insight_hash: hash,
        });

        await supabase.from('student_insight_registry').upsert({
          student_id: studentId,
          event_id: eventId,
          insight_hash: hash,
        }, { onConflict: 'insight_hash', ignoreDuplicates: true });
      } catch { /* Non-blocking */ }

      finalInsights.push({ ...insight, text: finalText });
    }

    return finalInsights;
  }

  /**
   * Get previously stored insights for a student + event (from DB cache).
   */
  static async getCachedInsights(studentId: string, eventId: string): Promise<RCCICInsight[]> {
    const { data } = await supabase
      .from('rccic_insights')
      .select('insight_type, subject, insight_text')
      .eq('student_id', studentId)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) return [];
    return data.map((r: any) => ({
      type: r.insight_type,
      subject: r.subject,
      text: r.insight_text,
    }));
  }

  /**
   * Main insight API — checks cache first, generates and persists if stale.
   */
  static async getInsights(studentId: string, eventId: string): Promise<RCCICInsight[]> {
    // Check cache first (valid for 1 hour)
    const { data: cached } = await supabase
      .from('rccic_insights')
      .select('insight_type, subject, insight_text, created_at')
      .eq('student_id', studentId)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (cached && cached.length >= 3) {
      const freshCutoff = Date.now() - 3600000; // 1 hour
      const isFresh = new Date((cached[0] as any).created_at).getTime() > freshCutoff;
      if (isFresh) {
        return cached.map((r: any) => ({
          type: r.insight_type,
          subject: r.subject,
          text: r.insight_text,
        }));
      }
    }

    // Generate fresh insights
    const insights = await this.generateRCCICInsights(studentId, eventId);
    if (insights.length === 0) return [];

    // Persist and deduplicate
    return this.persistInsights(studentId, eventId, insights);
  }

  // ─── Legacy helpers ──────────────────────────────────────────────────────────

  static async generateResultsInsight(
    studentId: string,
    results: ResultsMetrics,
    dashboardCtx: DashboardContext = 'student'
  ): Promise<string> {
    const { averageGradeNumeric, improvementDelta, subjectTrends } = results;
    let baseNarrative = '';

    if (improvementDelta > 0.1) {
      baseNarrative = `Significant academic growth detected. Overall performance improved by ${(improvementDelta * 100).toFixed(0)}% since the last evaluation. `;
    } else if (improvementDelta < -0.05) {
      baseNarrative = `Performance drift detected. A decline of ${Math.abs(improvementDelta * 100).toFixed(0)}% was observed in core assessment blocks. `;
    } else {
      baseNarrative = `Academic stability maintained. Current performance metrics are consistent with previous baselines. `;
    }

    const decliningSubjects = Object.entries(subjectTrends).filter(([, t]) => t === 'declining').map(([s]) => s);
    const improvingSubjects = Object.entries(subjectTrends).filter(([, t]) => t === 'improving').map(([s]) => s);

    if (improvingSubjects.length > 0) baseNarrative += `Momentum is particularly strong in ${improvingSubjects.join(', ')}. `;
    if (decliningSubjects.length > 0) baseNarrative += `Targeted focus recommended for ${decliningSubjects.join(', ')}. `;

    return baseNarrative;
  }

  static async generateStudentNarrative(studentId: string, eventId: string): Promise<string> {
    try {
      const insights = await this.getInsights(studentId, eventId);
      if (insights.length > 0) return insights[0].text;

      const metrics = await this.analyzeCrossEventPerformance(studentId);
      const overall = this.numericToGrade(metrics.averageGradeNumeric);
      const velocity = metrics.improvementVelocity || 0;
      return `Student demonstrates a ${overall} profile with a ${velocity > 0 ? 'positive' : 'divergent'} improvement velocity of ${(velocity * 100).toFixed(1)}%.`;
    } catch {
      return 'Stability guardian: Insight generation paused.';
    }
  }

  // ─── Utility ────────────────────────────────────────────────────────────────

  private static isValidUUID(id: string): boolean {
    return !!(id && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
  }
}
