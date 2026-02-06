'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  FileText, Calendar, Clock, CheckCircle2, ChevronRight, 
  Wifi, WifiOff, AlertCircle, ArrowLeft, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import AssignmentOnlinePlayer from '@/components/AssignmentOnlinePlayer';
import AssignmentOfflineSubmission from '@/components/AssignmentOfflineSubmission';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentAssignmentsManagerProps {
  studentId: string;
  className?: string;
  classId?: string;
  studentClass?: string;
}

export default function StudentAssignmentsManager({ 
  studentId, 
  className,
  classId,
  studentClass 
}: StudentAssignmentsManagerProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, [studentId, classId, studentClass]);

  async function fetchAssignments() {
    try {
      setLoading(true);
      
      let targetClassId = classId;
      if (!targetClassId && studentClass) {
          const { data: cls } = await supabase
            .from('classes')
            .select('id')
            .eq('name', studentClass)
            .single();
          if (cls) targetClassId = cls.id;
      }

      if (!targetClassId) {
          console.warn("No class ID found for student assignments");
          setLoading(false);
          return;
      }

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          subjects(name),
          student_submissions!left(id, status, score, submitted_at)
        `)
        .eq('class_id', targetClassId)
        .eq('status', 'PUBLISHED')
        .eq('student_submissions.student_id', studentId)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const processed = data?.map(a => ({
          ...a,
          submission: a.student_submissions?.[0] || null
      })) || [];

      setAssignments(processed);

    } catch (err) {
      console.error('Error fetching student assignments:', err);
    } finally {
      setLoading(false);
    }
  }

  if (selectedAssignment) {
      return (
          <div className="animate-in slide-in-from-right-4 fade-in duration-300">
              <button 
                onClick={() => {
                    setSelectedAssignment(null);
                    fetchAssignments();
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
              >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Assignments
              </button>

              {selectedAssignment.type === 'ONLINE_AUTO_GRADED' ? (
                  <AssignmentOnlinePlayer 
                    assignment={selectedAssignment} 
                    studentId={studentId}
                    onComplete={() => {
                        fetchAssignments();
                        setSelectedAssignment(null);
                    }}
                  />
              ) : (
                  <AssignmentOfflineSubmission 
                     assignment={selectedAssignment}
                     studentId={studentId}
                     onComplete={() => {
                        fetchAssignments();
                        setSelectedAssignment(null);
                     }}
                  />
              )}
          </div>
      );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Your Class Assignments
          </h2>
      </div>

      {loading ? (
          <div className="space-y-4">
              {[1,2,3].map(i => (
                  <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
              ))}
          </div>
      ) : assignments.length === 0 ? (
          <div className="text-center py-12 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
            <p className="text-slate-400">No active assignments for your class.</p>
          </div>
      ) : (
          <div className="grid gap-4">
              {assignments.map(assignment => {
                  const isSubmitted = !!assignment.submission;
                  const isGraded = assignment.submission?.status === 'MARKED';
                  const isLate = !isSubmitted && new Date(assignment.due_date) < new Date();
                  const isOnline = assignment.type === 'ONLINE_AUTO_GRADED';

                  return (
                      <div 
                        key={assignment.id}
                        onClick={() => {
                            console.log("Clicked assignment card:", assignment.id);
                            setSelectedAssignment(assignment);
                        }}
                        className={cn(
                            "cursor-pointer group relative bg-slate-800/40 backdrop-blur-md border rounded-xl p-5 transition-all hover:bg-slate-800/60",
                            isSubmitted ? "border-emerald-500/30" : 
                            isLate ? "border-red-500/30" : "border-slate-700 hover:border-indigo-500/50"
                        )}
                      >
                          <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                  <div className={cn(
                                      "p-3 rounded-xl flex items-center justify-center transition-colors",
                                      isSubmitted ? "bg-emerald-500/10 text-emerald-400" :
                                      isOnline ? "bg-indigo-500/10 text-indigo-400" : "bg-amber-500/10 text-amber-400"
                                  )}>
                                      {isSubmitted ? <CheckCircle2 className="w-6 h-6" /> : 
                                       isOnline ? <Wifi className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                                  </div>
                                  
                                  <div>
                                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors mb-1">
                                          {assignment.title}
                                      </h3>
                                      <div className="flex items-center gap-3 text-sm text-slate-400">
                                          <span className="flex items-center gap-1">
                                              <FileText className="w-3.5 h-3.5" />
                                              {assignment.subjects?.name || 'General'}
                                          </span>
                                          <span className="w-1 h-1 bg-slate-600 rounded-full" />
                                          <span className={cn(
                                              "flex items-center gap-1",
                                              isLate ? "text-red-400 font-medium" : ""
                                          )}>
                                              <Clock className="w-3.5 h-3.5" />
                                              {format(new Date(assignment.due_date), 'MMM d, h:mm a')}
                                          </span>
                                      </div>
                                  </div>
                              </div>

                              <div className="flex items-center gap-3">
                                  {isGraded && (
                                      <div className="text-right">
                                          <div className="text-2xl font-bold text-emerald-400">
                                              {assignment.submission.score}/{assignment.total_marks}
                                          </div>
                                          <div className="text-xs text-emerald-500/70 font-medium">GRADED</div>
                                      </div>
                                  )}
                              </div>
                          </div>
                          
                          {/* Explicit Action Button - Added relative and z-index to ensure clickability */}
                          <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-end relative z-10">
                              <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      console.log("Clicked assignment button:", assignment.id);
                                      setSelectedAssignment(assignment);
                                  }}
                                  className={cn(
                                      "px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2",
                                      isSubmitted 
                                        ? "bg-slate-700 hover:bg-slate-600 text-slate-200" 
                                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                                  )}
                              >
                                  {isSubmitted ? (isGraded ? 'View Result' : 'View Submission') : 'Open Assignment'}
                                  <ArrowRight className="w-4 h-4" />
                              </button>
                          </div>

                          {isLate && !isSubmitted && (
                             <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded">
                                 <AlertCircle className="w-3 h-3" />
                                 LATE
                             </div>
                          )}
                      </div>
                  );
              })}
          </div>
      )}
    </div>
  );
}
