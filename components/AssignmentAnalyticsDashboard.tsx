'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  TrendingUp, TrendingDown, Users, Target, 
  BarChart3, PieChart as PieChartIcon, Activity,
  Calendar, ChevronLeft, Download, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  ArcElement
);

const supabase = createClient();

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface Submission {
  id: string;
  score: number;
  status: string;
  submitted_at: string;
}

export default function AssignmentAnalyticsDashboard({ 
  assignmentId, 
  onBack 
}: { 
  assignmentId: string; 
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null); // Keep as any for now as it's a large dynamic object
  const [performanceData, setPerformanceData] = useState<{range: string, count: number}[]>([]);
  const [difficultyData, setDifficultyData] = useState<{name: string, successRate: string, fullText: string}[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [assignmentId]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      // 1. Fetch Overview Stats
      const { data: assignment } = await supabase
        .from('assignments')
        .select('*, subjects(name), classes(name)')
        .eq('id', assignmentId)
        .single();
      
      const { data: submissions } = await supabase
        .from('student_submissions')
        .select('id, score, status, submitted_at')
        .eq('assignment_id', assignmentId)
        .not('score', 'is', null) as { data: Submission[] | null };

      const { count: totalRecipients } = await supabase
        .from('assignment_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_id', assignmentId);

      const scores = submissions?.map((s: Submission) => s.score) || [];
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
      const minScore = scores.length > 0 ? Math.min(...scores) : 0;

      setStats({
        title: assignment?.title,
        subject: assignment?.subjects?.name,
        class: assignment?.classes?.name,
        totalMarks: assignment?.total_marks,
        avgScore: avgScore.toFixed(1),
        maxScore,
        minScore,
        submissionCount: submissions?.length || 0,
        participationRate: totalRecipients ? ((submissions?.length || 0) / totalRecipients * 100).toFixed(1) : '0'
      });

      // 2. Score Distribution
      const distribution = [
        { range: '0-20%', count: 0 },
        { range: '21-40%', count: 0 },
        { range: '41-60%', count: 0 },
        { range: '61-80%', count: 0 },
        { range: '81-100%', count: 0 },
      ];

      scores.forEach(s => {
        const perc = (s / assignment.total_marks) * 100;
        if (perc <= 20) distribution[0].count++;
        else if (perc <= 40) distribution[1].count++;
        else if (perc <= 60) distribution[2].count++;
        else if (perc <= 80) distribution[3].count++;
        else distribution[4].count++;
      });
      setPerformanceData(distribution);

      // 3. Question Analytics (Difficulty)
      const { data: questionMarkings } = await supabase
        .from('question_markings')
        .select(`
          marks_awarded,
          question_id,
          assignment_questions(question_text, marks)
        `)
        .eq('submission_id', submissions?.[0]?.id); // This is a simplification, should aggregate

      // Reality: Aggregate from raw markings for this assignment
      const { data: allMarkings } = await supabase
        .from('question_markings')
        .select(`
          marks_awarded,
          question_id,
          assignment_questions!inner(question_text, marks)
        `)
        .eq('assignment_questions.assignment_id', assignmentId);

      const questionStats: Record<string, { total: number, count: number, text: string, max: number }> = {};
      (allMarkings as any[])?.forEach((m: { 
        question_id: string; 
        marks_awarded: number; 
        assignment_questions: { question_text: string; marks: number } 
      }) => {
        if (!questionStats[m.question_id]) {
          questionStats[m.question_id] = { total: 0, count: 0, text: m.assignment_questions.question_text, max: m.assignment_questions.marks };
        }
        questionStats[m.question_id].total += m.marks_awarded;
        questionStats[m.question_id].count++;
      });

      const diffList = Object.values(questionStats).map((q, idx) => ({
        name: `Q${idx + 1}`,
        successRate: ((q.total / (q.count * q.max)) * 100).toFixed(1),
        fullText: q.text
      }));
      setDifficultyData(diffList);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400 bg-[#0a0c10]">
        <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
        <p className="font-black uppercase tracking-widest text-xs">Computing Intelligence Metrics...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0c10] text-slate-200 p-8 custom-scrollbar overflow-y-auto">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-6">
           <button onClick={onBack} className="p-3 bg-slate-900 border border-white/5 text-slate-400 hover:text-white rounded-2xl transition-all">
              <ChevronLeft className="w-6 h-6" />
           </button>
           <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Mission Intelligence Dashboard</h1>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 flex items-center gap-3">
                 <Activity className="w-4 h-4 text-indigo-500" /> {stats?.title} <span className="text-slate-700">|</span> {stats?.class}
              </p>
           </div>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-indigo-500/20">
           <Download className="w-4 h-4" /> Export Intelligence Report
        </button>
      </div>

      {/* ── METRIC GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Success Velocity', value: `${stats?.avgScore}`, sub: `Avg Pts / ${stats?.totalMarks}`, icon: TrendingUp, color: 'indigo' },
          { label: 'Cohort Engagement', value: `${stats?.participationRate}%`, sub: `${stats?.submissionCount} Respondents`, icon: Users, color: 'emerald' },
          { label: 'Peak Performance', value: `${stats?.maxScore}`, sub: 'Top Scorer Value', icon: Target, color: 'amber' },
          { label: 'Evaluation Range', value: `${stats?.minScore} - ${stats?.maxScore}`, sub: 'Score Variance', icon: BarChart3, color: 'rose' },
        ].map((m, i) => (
          <div key={i} className="bg-[#0f1117] border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
             <div className={cn("absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity", `text-${m.color}-500`)}>
                <m.icon className="w-16 h-16" />
             </div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{m.label}</p>
             <h3 className="text-4xl font-black text-white mb-2">{m.value}</h3>
             <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
         {/* Performance Distribution */}
         <div className="bg-[#0f1117] border border-white/5 p-10 rounded-[3rem] shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-8 flex items-center gap-3">
               <PieChartIcon className="w-5 h-5 text-indigo-500" /> Performance Distribution Matrix
            </h3>
            <div className="h-[300px] w-full">
               <Bar 
                 data={{
                   labels: performanceData.map(d => d.range),
                   datasets: [{
                     label: 'Units',
                     data: performanceData.map(d => d.count),
                     backgroundColor: '#6366f1',
                     borderRadius: 8,
                   }]
                 }}
                 options={{
                   responsive: true,
                   maintainAspectRatio: false,
                   plugins: {
                     legend: { display: false },
                   },
                   scales: {
                     y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } },
                     x: { grid: { display: false }, ticks: { color: '#64748b' } }
                   }
                 }}
               />
            </div>
         </div>

         {/* Question Success Rate */}
         <div className="bg-[#0f1117] border border-white/5 p-10 rounded-[3rem] shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-8 flex items-center gap-3">
               <Activity className="w-5 h-5 text-emerald-500" /> Question-Level success analysis
            </h3>
            <div className="h-[300px] w-full">
               <Line 
                 data={{
                   labels: difficultyData.map(d => d.name),
                   datasets: [{
                     label: 'Success %',
                     data: difficultyData.map(d => d.successRate),
                     borderColor: '#10b981',
                     backgroundColor: 'rgba(16, 185, 129, 0.1)',
                     fill: true,
                     tension: 0.4,
                     borderWidth: 4,
                     pointRadius: 6,
                     pointBackgroundColor: '#10b981',
                   }]
                 }}
                 options={{
                   responsive: true,
                   maintainAspectRatio: false,
                   plugins: {
                     legend: { display: false },
                   },
                   scales: {
                     y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } },
                     x: { grid: { display: false }, ticks: { color: '#64748b' } }
                   }
                 }}
               />
            </div>
         </div>
      </div>

      {/* ── QUESTION INSIGHTS TABLE ── */}
      <div className="bg-[#0f1117] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl mb-24">
         <div className="p-10 border-b border-white/5 bg-white/5">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Question Unit Diagnostics</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-white/5">
                     <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit Reference</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Content Preview</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Success Velocity</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Unit Grade</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {difficultyData.map((d, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                       <td className="px-10 py-8 font-black text-white text-lg">{d.name}</td>
                       <td className="px-10 py-8">
                          <p className="text-slate-400 text-xs truncate max-w-xs">{d.fullText}</p>
                       </td>
                       <td className="px-10 py-8">
                          <div className="flex items-center gap-4">
                             <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000",
                                    Number(d.successRate) > 70 ? "bg-emerald-500" : Number(d.successRate) > 40 ? "bg-amber-500" : "bg-rose-500"
                                  )} 
                                  style={{ width: `${d.successRate}%` }} 
                                />
                             </div>
                             <span className="text-[10px] font-black text-slate-500">{d.successRate}%</span>
                          </div>
                       </td>
                       <td className="px-10 py-8 text-right">
                          <span className={cn(
                             "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest",
                             Number(d.successRate) > 70 ? "bg-emerald-500/10 text-emerald-400" : Number(d.successRate) > 40 ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                          )}>
                             {Number(d.successRate) > 70 ? 'Optimal' : Number(d.successRate) > 40 ? 'Moderate' : 'Critical'}
                          </span>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
