'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  X, Search, Filter, Download, CheckCircle2, 
  AlertCircle, Clock, ChevronRight, Save, User,
  FileText, ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AssignmentGradingViewProps {
  assignment: any; // The full assignment object
  onClose: () => void;
}

interface StudentSubmission {
  student_id: string;
  full_name: string;
  admission_number: string;
  avatar_url?: string;
  submission?: {
    id: string;
    submitted_at: string;
    status: string;
    score: number | null;
    teacher_feedback: string | null;
    attachment_urls: string[];
    submission_content: string;
  } | null;
}

export default function AssignmentGradingView({ assignment, onClose }: AssignmentGradingViewProps) {
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentSubmission | null>(null);
  const [stats, setStats] = useState({ total: 0, submitted: 0, graded: 0 });

  // Grading State
  const [gradeScore, setGradeScore] = useState<number | string>(''); // string allowed for empty input
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [assignment.id]);

  useEffect(() => {
    if (selectedStudent?.submission) {
      setGradeScore(selectedStudent.submission.score ?? '');
      setFeedback(selectedStudent.submission.teacher_feedback ?? '');
    } else {
      setGradeScore('');
      setFeedback('');
    }
  }, [selectedStudent]);

  async function fetchData() {
    try {
      setLoading(true);

      // 1. Fetch Class Roster (Students)
      // We need to find the class name first if we only have ID? 
      // Actually assignment has class_id. We need to find students in that class.
      // Profiles has 'form_class' (name). Classes table has id->name.
      // So fetch class name first.
      
      let className = assignment.classes?.name;
      if (!className) {
          const { data: cls } = await supabase.from('classes').select('name').eq('id', assignment.class_id).single();
          className = cls?.name;
      }

      if (!className) {
          console.error("Could not find class name for roster");
          return;
      }

      const { data: roster, error: rosterError } = await supabase
        .from('profiles')
        .select('id, full_name, admission_number, avatar_url')
        .eq('form_class', className)
        .eq('role', 'student')
        .order('full_name');

      if (rosterError) throw rosterError;

      // 2. Fetch Submissions
      const { data: submissions, error: subError } = await supabase
        .from('student_submissions')
        .select('*')
        .eq('assignment_id', assignment.id);

      if (subError) throw subError;

      // 3. Merge Data
      const submissionMap = new Map(submissions?.map(s => [s.student_id, s]));
      
      const merged: StudentSubmission[] = (roster || []).map(student => ({
          student_id: student.id,
          full_name: student.full_name,
          admission_number: student.admission_number,
          avatar_url: student.avatar_url,
          submission: submissionMap.get(student.id) || null
      }));

      setStudents(merged);

      // Calculate Stats
      const submittedCount = submissions?.length || 0;
      const gradedCount = submissions?.filter(s => s.status === 'GRADED').length || 0;
      setStats({
          total: roster?.length || 0,
          submitted: submittedCount,
          graded: gradedCount
      });

    } catch (err) {
      console.error('Error fetching grading data:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveGrade = async () => {
    if (!selectedStudent || !selectedStudent.submission) return;

    setIsSaving(true);
    try {
        const scoreVal = Number(gradeScore);
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > assignment.total_marks) {
            alert(`Invalid score. Must be between 0 and ${assignment.total_marks}`);
            return;
        }

        const { error } = await supabase
            .from('student_submissions')
            .update({
                score: scoreVal,
                teacher_feedback: feedback,
                status: 'GRADED'
            })
            .eq('id', selectedStudent.submission.id);

        if (error) throw error;

        // Update local state
        setStudents(prev => prev.map(s => {
            if (s.student_id === selectedStudent.student_id) {
                return {
                    ...s,
                    submission: {
                        ...s.submission!, // Guaranteed to exist (checked above)
                        score: scoreVal,
                        teacher_feedback: feedback,
                        status: 'GRADED'
                    }
                };
            }
            return s;
        }));

        // Maybe move to next student automatically?
        // For now, just show success
        alert('Grade saved!');

    } catch (err) {
        console.error('Error saving grade:', err);
        alert('Failed to save grade');
    } finally {
        setIsSaving(false);
    }
  };

  const getStatusBadge = (student: StudentSubmission) => {
      if (!student.submission) return <span className="text-slate-500 text-xs font-medium">Missing</span>;
      if (student.submission.status === 'GRADED') return <span className="text-emerald-400 text-xs font-bold px-2 py-0.5 bg-emerald-500/10 rounded">Graded: {student.submission.score}</span>;
      return <span className="text-amber-400 text-xs font-bold px-2 py-0.5 bg-amber-500/10 rounded">Submitted</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 animate-in slide-in-from-bottom-5">
       {/* Header */}
       <div className="h-16 border-b border-slate-700 bg-slate-800/80 backdrop-blur-md flex items-center justify-between px-6">
           <div className="flex items-center gap-4">
               <Button variant="ghost" size="icon" onClick={onClose}>
                   <ArrowLeft className="w-5 h-5 text-slate-400" />
               </Button>
               <div>
                   <h2 className="text-white font-bold text-lg">{assignment.title}</h2>
                   <p className="text-slate-400 text-xs">
                       {assignment.className} • {stats.submitted}/{stats.total} Submitted • {stats.graded}/{stats.submitted} Graded
                   </p>
               </div>
           </div>
           
           <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                    <div className="text-xs text-slate-400">Total Marks</div>
                    <div className="text-emerald-400 font-bold font-mono text-lg">{assignment.total_marks}</div>
                </div>
           </div>
       </div>

       <div className="flex-1 flex overflow-hidden">
           {/* Sidebar: Student List */}
           <div className="w-80 border-r border-slate-700 bg-slate-800/30 flex flex-col">
               <div className="p-4 border-b border-slate-700">
                   <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                       <input 
                         type="text" 
                         placeholder="Search students..." 
                         className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                       />
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                   {loading ? (
                       <div className="p-4 space-y-3">
                           {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse" />)}
                       </div>
                   ) : (
                       students.map(student => (
                           <div 
                             key={student.student_id}
                             onClick={() => setSelectedStudent(student)}
                             className={cn(
                                 "p-4 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30 transition-colors",
                                 selectedStudent?.student_id === student.student_id ? "bg-indigo-500/10 border-l-4 border-l-indigo-500" : "border-l-4 border-l-transparent"
                             )}
                           >
                               <div className="flex justify-between items-start mb-1">
                                   <h4 className={cn(
                                       "font-medium text-sm",
                                       selectedStudent?.student_id === student.student_id ? "text-white" : "text-slate-300"
                                   )}>{student.full_name}</h4>
                                   {getStatusBadge(student)}
                               </div>
                               <p className="text-xs text-slate-500">{student.admission_number}</p>
                           </div>
                       ))
                   )}
               </div>
           </div>

           {/* Main Area: Grading Interface */}
           <div className="flex-1 overflow-y-auto bg-slate-900 relative">
               {selectedStudent ? (
                   !selectedStudent.submission ? (
                       <div className="flex flex-col items-center justify-center h-full text-slate-500">
                           <Clock className="w-16 h-16 mb-4 opacity-20" />
                           <p className="text-lg font-medium">No submission yet</p>
                           <p className="text-sm">This student has not submitted the assignment.</p>
                       </div>
                   ) : (
                       <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                           {/* Submission Content */}
                           <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                               <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                                   <div className="flex items-center gap-3">
                                       <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                           <FileText className="w-5 h-5" />
                                       </div>
                                       <div>
                                           <h3 className="text-white font-medium">Submission Details</h3>
                                           <p className="text-xs text-slate-400">
                                               Submitted: {format(new Date(selectedStudent.submission.submitted_at), 'PPP p')}
                                           </p>
                                       </div>
                                   </div>
                               </div>
                               
                               <div className="p-6 space-y-6">
                                   {selectedStudent.submission.submission_content && (
                                       <div>
                                           <h4 className="text-xs text-slate-500 uppercase font-bold mb-2">Student Notes</h4>
                                           <div className="p-4 bg-slate-900/50 rounded-xl text-slate-300 whitespace-pre-wrap border border-slate-700/50">
                                               {selectedStudent.submission.submission_content}
                                           </div>
                                       </div>
                                   )}

                                   {selectedStudent.submission.attachment_urls && selectedStudent.submission.attachment_urls.length > 0 && (
                                       <div>
                                           <h4 className="text-xs text-slate-500 uppercase font-bold mb-2">Attachments</h4>
                                           <div className="grid gap-3">
                                               {selectedStudent.submission.attachment_urls.map((url, idx) => (
                                                   <a 
                                                     key={idx}
                                                     href={url}
                                                     target="_blank"
                                                     rel="noopener noreferrer"
                                                     className="flex items-center gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded-xl transition-colors group"
                                                   >
                                                       <Download className="w-5 h-5 text-indigo-400" />
                                                       <span className="text-sm text-indigo-300 group-hover:text-white underline decoration-dashed underline-offset-4">
                                                           Download Attachment {idx + 1}
                                                       </span>
                                                   </a>
                                               ))}
                                           </div>
                                       </div>
                                   )}
                               </div>
                           </div>

                           {/* Greeting/Action Area */}
                           <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-6 shadow-xl">
                               <h3 className="text-white font-bold flex items-center gap-2">
                                   <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                   Grading & Feedback
                               </h3>
                               
                               <div className="grid md:grid-cols-3 gap-6">
                                   <div>
                                       <label className="text-sm font-medium text-slate-400 mb-1.5 block">Score (out of {assignment.total_marks})</label>
                                       <div className="relative">
                                           <input 
                                             type="number" 
                                             value={gradeScore}
                                             onChange={(e) => setGradeScore(e.target.value)}
                                             className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                             min={0}
                                             max={assignment.total_marks}
                                           />
                                           <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                                               / {assignment.total_marks}
                                           </span>
                                       </div>
                                   </div>
                                   <div className="md:col-span-2">
                                       <label className="text-sm font-medium text-slate-400 mb-1.5 block">Feedback</label>
                                       <textarea 
                                          value={feedback}
                                          onChange={(e) => setFeedback(e.target.value)}
                                          placeholder="Good work, keep it up!"
                                          rows={3}
                                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                                       />
                                   </div>
                               </div>

                               <div className="flex justify-end pt-4 border-t border-slate-700/50">
                                   <Button 
                                     onClick={handleSaveGrade}
                                     disabled={isSaving}
                                     className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-500/20"
                                   >
                                       {isSaving ? 'Saving...' : 'Save Grade'}
                                   </Button>
                               </div>
                           </div>
                       </div>
                   )
               ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-500">
                       <User className="w-16 h-16 mb-4 opacity-20" />
                       <p className="text-lg font-medium">Select a student</p>
                       <p className="text-sm">Choose a student from the sidebar to view their submission.</p>
                   </div>
               )}
           </div>
       </div>
    </div>
  );
}
