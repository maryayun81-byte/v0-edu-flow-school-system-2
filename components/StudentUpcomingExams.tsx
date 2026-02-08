"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

// Types
interface Exam {
  id: string;
  exam_name: string;
  academic_year: number;
  term: string;
  start_date: string;
  end_date: string;
  status: "Draft" | "Active" | "Closed" | "Finalized";
  applicable_classes: string[];
}

interface StudentUpcomingExamsProps {
  studentClassName: string; // Used to resolve class ID for filtering
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function StudentUpcomingExams({ studentClassName }: StudentUpcomingExamsProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentClassName) {
      fetchExams();
    }
  }, [studentClassName]);

  async function fetchExams() {
    try {
      // 1. Get Class ID for the student's class name
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("id")
        .eq("name", studentClassName)
        .single();

      if (classError || !classData) {
        console.error("Error fetching class ID:", classError);
        setLoading(false);
        return;
      }

      const studentClassId = classData.id;

      // 2. Fetch Active Exams
      // Filter logic:
      // - Status is Active or Upcoming (Active covers both in this system typically, or we check dates)
      // - Student's class is in applicable_classes
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .in("status", ["Active"]) // Only show Active exams (admins activate them)
        .contains("applicable_classes", [studentClassId]) // Class Filter
        .order("start_date", { ascending: true });

      if (examsError) {
        console.error("Error fetching exams:", examsError);
        setLoading(false);
        return;
      }

      if (examsData) {
        // Client-side date filtering to be safe/precise (e.g. handle 'Active' status but past end_date if backend job didn't run)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const visibleExams = examsData.filter((exam) => {
          const endDate = new Date(exam.end_date);
          endDate.setHours(23, 59, 59, 999);
          return endDate >= today; // Show until the end of the last day
        });

        setExams(visibleExams);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-24 bg-card/50 animate-pulse rounded-2xl border border-border/50 mb-6" />
    );
  }

  if (exams.length === 0) {
    return (
      <div className="mb-6 p-6 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40 text-center">
        <p className="text-muted-foreground font-medium">No upcoming exams scheduled for your class.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <h3 className="text-lg font-semibold text-foreground/80 tracking-tight flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Upcoming Exams
      </h3>
      
      <div className="space-y-4">
        {exams.map((exam) => {
          const startDate = new Date(exam.start_date);
          const endDate = new Date(exam.end_date);
          const today = new Date();
          
          // Reset times for accurate comparison
          today.setHours(0,0,0,0);
          const startCheck = new Date(startDate); 
          startCheck.setHours(0,0,0,0);
          
          const isStarted = today >= startCheck;
          
          return (
            <div
              key={exam.id}
              className={cn(
                "relative overflow-hidden rounded-xl p-5 border transition-all duration-500",
                isStarted 
                  ? "bg-card border-l-4 border-l-blue-500 border-border/50 shadow-sm" // Active: Solid, stable
                  : "bg-gradient-to-br from-card to-card/50 border-blue-500/30 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]" // Upcoming: Glow
              )}
            >
              {/* Glow Animation for Upcoming */}
              {!isStarted && (
                <div className="absolute inset-0 z-0">
                   <div className="absolute inset-0 bg-blue-500/5 animate-[pulse_4s_ease-in-out_infinite]" />
                </div>
              )}

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-lg font-bold text-foreground tracking-tight">
                      {exam.exam_name}
                    </h4>
                    {isStarted ? (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-900">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                        </span>
                        In Progress
                      </span>
                    ) : (
                       <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider border border-border">
                        Upcoming
                      </span> 
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground/80">{exam.term} • {exam.academic_year}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{studentClassName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded-lg border border-border/50 backdrop-blur-sm self-start sm:self-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Starts</span>
                    <span className="font-mono text-sm font-semibold">{startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="w-8 h-[1px] bg-border/80" />
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Ends</span>
                    <span className="font-mono text-sm font-semibold">{endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
