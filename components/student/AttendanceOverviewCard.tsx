"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Brain, 
  ChevronRight,
  Flame
} from "lucide-react";

const supabase = createClient();

interface AttendanceRecord {
  attendance_date: string;
  status: "present" | "late" | "absent" | "excused";
}

export default function AttendanceOverviewCard({ 
  studentId, 
  onViewFull 
}: { 
  studentId: string; 
  onViewFull: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (studentId) loadData();
  }, [studentId]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("attendance_date, status")
      .eq("student_id", studentId)
      .order("attendance_date", { ascending: false });
    
    setRecords(data || []);
    setLoading(false);
  }

  const stats = useMemo(() => {
    if (records.length === 0) return null;

    const total = records.length;
    const present = records.filter(r => r.status === "present").length;
    const late = records.filter(r => r.status === "late").length;
    const absent = records.filter(r => r.status === "absent").length;
    
    const percentage = Math.round(((present + late) / total) * 100);
    
    // Streak calculation
    let streak = 0;
    for (const record of records) {
      if (record.status === "present" || record.status === "late") {
        streak++;
      } else {
        break;
      }
    }

    const recent = records.slice(0, 5).reverse().map(r => ({
      day: new Date(r.attendance_date).toLocaleDateString("en-US", { weekday: "short" }),
      status: r.status
    }));

    // Insight Logic
    let insight = "";
    if (percentage >= 90) {
      insight = "Your attendance is excellent this term. Maintaining this pattern increases your chances of top performance.";
    } else if (percentage >= 75) {
      insight = "Good job! You're consistently showing up. A small effort to reduce lates will make it perfect.";
    } else {
      insight = "Your attendance dropped recently. Consistent attendance improves learning retention and helps you stay on track.";
    }

    return { percentage, present, late, absent, streak, recent, insight };
  }, [records]);

  if (loading) return (
     <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6 h-[450px] animate-pulse flex flex-col justify-between">
       <div className="flex justify-between items-start">
         <div className="space-y-2">
           <div className="h-6 w-32 bg-muted rounded-full" />
           <div className="h-3 w-48 bg-muted rounded-full" />
         </div>
       </div>
       <div className="space-y-6">
         <div className="mx-auto h-36 w-36 rounded-full border-8 border-muted" />
         <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
         </div>
       </div>
       <div className="space-y-3">
          <div className="h-3 w-24 bg-muted rounded-full" />
          <div className="flex justify-between gap-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 w-10 bg-muted rounded-xl" />)}
          </div>
       </div>
       <div className="h-12 bg-muted rounded-xl" />
     </div>
  );

  if (!stats) return (
    <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-8 text-center">
       <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
         <Calendar className="w-8 h-8 text-muted-foreground opacity-50" />
       </div>
       <h3 className="text-lg font-semibold text-foreground">Ready to start?</h3>
       <p className="text-sm text-muted-foreground max-w-[250px] mx-auto mt-2">Your attendance stats will appear here once the register is marked.</p>
    </div>
  );

  const getColor = (pct: number) => {
    if (pct >= 90) return "text-green-500";
    if (pct >= 75) return "text-yellow-500";
    return "text-red-500";
  };

  const getSVGColor = (pct: number) => {
    if (pct >= 90) return "#22c55e"; 
    if (pct >= 75) return "#eab308";
    return "#ef4444";
  };

  return (
    <div className="group relative bg-card/60 backdrop-blur-3xl border border-border/50 rounded-2xl p-6 transition-all duration-700 hover:border-primary/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.2)] hover:shadow-primary/5 overflow-hidden">
      {/* Premium background effects */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-all duration-700" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/5 rounded-full blur-[80px] group-hover:bg-accent/10 transition-all duration-700" />
      
      {/* Header Section */}
      <div className="flex items-start justify-between mb-8 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-2xl font-bold text-foreground tracking-tight">Attendance</h3>
            {stats.streak >= 2 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase animate-pulse">
                <Flame className="w-3.5 h-3.5 fill-orange-500/20" />
                <span>{stats.streak} DAY STREAK</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground font-medium">Your performance this term</p>
        </div>
        <button 
          onClick={onViewFull}
          className="text-primary hover:text-primary/70 text-sm font-bold flex items-center gap-1.5 transition-all group/btn"
        >
          View Full <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 whitespace-nowrap" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 relative z-10">
        {/* Progress Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-44 h-44 group/circle">
             {/* Gradient for progress */}
             <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_15px_rgba(0,0,0,0.1)]">
               <circle
                 cx="88"
                 cy="88"
                 r="76"
                 fill="transparent"
                 stroke="currentColor"
                 strokeWidth="14"
                 className="text-muted/20"
               />
               <circle
                 cx="88"
                 cy="88"
                 r="76"
                 fill="transparent"
                 stroke={getSVGColor(stats.percentage)}
                 strokeWidth="14"
                 strokeDasharray={477}
                 strokeDashoffset={477 - (477 * stats.percentage) / 100}
                 strokeLinecap="round"
                 className="transition-all duration-1000 ease-out delay-200"
               />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
               <span className="text-4xl font-black text-foreground drop-shadow-sm">{stats.percentage}%</span>
               <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mt-1">Consistency</span>
             </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="flex flex-col justify-center gap-3">
           <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/20 rounded-2xl p-4 text-center border border-border/30 hover:bg-green-500/5 hover:border-green-500/20 transition-all duration-300">
                <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-foreground leading-none">{stats.present}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">Present</div>
              </div>
              <div className="bg-muted/20 rounded-2xl p-4 text-center border border-border/30 hover:bg-red-500/5 hover:border-red-500/20 transition-all duration-300">
                <XCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-foreground leading-none">{stats.absent}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">Absent</div>
              </div>
              <div className="bg-muted/20 rounded-2xl p-4 text-center border border-border/30 hover:bg-yellow-500/5 hover:border-yellow-500/20 transition-all duration-300">
                <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-foreground leading-none">{stats.late}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">Late</div>
              </div>
           </div>
           
           {/* Mini Streak Display for Mobile */}
           <div className="md:hidden mt-2 bg-orange-500/5 border border-orange-500/10 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground tracking-tight">CURRENT STREAK</span>
              <div className="flex items-center gap-2">
                 <span className="text-lg font-black text-orange-500">{stats.streak} DAYS</span>
                 <Flame className="w-5 h-5 text-orange-500" />
              </div>
           </div>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="mb-8 relative z-10">
         <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Recent Activity</h4>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span className="text-[10px] text-muted-foreground font-bold">Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <span className="text-[10px] text-muted-foreground font-bold">Absent</span>
              </div>
            </div>
         </div>
         <div className="grid grid-cols-5 gap-3">
            {stats.recent.map((r, i) => (
              <div key={i} className="flex flex-col items-center gap-2 group/icon">
                <div className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter">{r.day}</div>
                <div className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  r.status === 'present' ? 'bg-green-500/10 text-green-500 ring-1 ring-green-500/20 group-hover/icon:scale-110' :
                  r.status === 'late' ? 'bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/20 group-hover/icon:scale-110' :
                  r.status === 'absent' ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20 group-hover/icon:scale-110' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {r.status === 'present' && <CheckCircle className="w-6 h-6" />}
                  {r.status === 'late' && <Clock className="w-6 h-6" />}
                  {r.status === 'absent' && <XCircle className="w-6 h-6" />}
                </div>
              </div>
            ))}
         </div>
      </div>

      {/* AI Insight Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 rounded-2xl p-5 border border-primary/20 shadow-inner group/insight overflow-hidden">
        {/* Animated background lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary animate-pulse" />
             <path d="M0,60 Q25,40 50,60 T100,60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-accent animate-pulse delay-700" />
          </svg>
        </div>
        
        <div className="flex gap-4 items-start relative z-10">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10 group-hover/insight:scale-110 transition-transform duration-500">
             <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">SIRIUS AI INSIGHT</div>
              <div className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
            </div>
            <p className="text-sm text-foreground/90 font-medium italic leading-relaxed tracking-tight group-hover/insight:text-foreground transition-colors">
              "{stats.insight}"
            </p>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <button 
        onClick={onViewFull}
        className="w-full mt-8 bg-foreground text-background font-black py-4.5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 group/mainbtn shadow-xl hover:shadow-primary/20"
      >
        <span>View Full Analytics</span>
        <TrendingUp className="w-5 h-5 group-hover/mainbtn:translate-x-1 group-hover/mainbtn:-translate-y-1 transition-transform" />
      </button>
    </div>
  );
}
