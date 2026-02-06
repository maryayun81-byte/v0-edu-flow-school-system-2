'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, Calendar, Wifi, WifiOff, FileText, Trash2, 
  Search, Filter, ExternalLink, Clock, Users, BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import AssignmentWizard from './AssignmentWizard';
import AssignmentGradingView from './AssignmentGradingView';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ClassAssignmentsManagerProps {
  userId: string;
}

interface Assignment {
  id: string;
  title: string;
  type: 'ONLINE_AUTO_GRADED' | 'OFFLINE_DOCUMENT_BASED';
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  due_date: string;
  created_at: string;
  total_marks: number;
  classes?: { name: string };
  subjects?: { name: string };
  submission_count?: number; // Approximate or fetched separately
}

export default function ClassAssignmentsManager({ userId }: ClassAssignmentsManagerProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [gradingAssignment, setGradingAssignment] = useState<any>(null);

  useEffect(() => {
    fetchAssignments();
  }, [userId]);

  async function fetchAssignments() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          classes (name),
          subjects (name)
        `)
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Ideally we would count submissions too, but let's keep it simple for now or fetch count
      setAssignments(data || []);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure? This will delete the assignment and ALL student submissions.')) return;
    
    await supabase.from('assignments').delete().eq('id', id);
    fetchAssignments();
  }

  const filteredAssignments = assignments.filter(a => {
      if (selectedStatus === 'all') return true;
      return a.status === selectedStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
         <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
            {['all', 'PUBLISHED', 'DRAFT'].map((s) => (
                <button
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                        selectedStatus === s 
                            ? "bg-indigo-500 text-white shadow-sm" 
                            : "text-slate-400 hover:text-white"
                    )}
                >
                    {s}
                </button>
            ))}
         </div>

         <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all font-medium shadow-lg shadow-indigo-500/20"
         >
            <Plus className="w-4 h-4" />
            Create Assignment
         </button>
      </div>

      {loading ? (
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {[1,2,3].map(i => (
                   <div key={i} className="h-48 bg-slate-800/50 rounded-2xl animate-pulse" />
               ))}
           </div>
      ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Assignments Found</h3>
            <p className="text-slate-400 max-w-sm mx-auto mb-6">
                You haven't created any assignments yet. Click "Create Assignment" to get started.
            </p>
            <button
                onClick={() => setShowWizard(true)}
                className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
                Create your first assignment &rarr;
            </button>
          </div>
      ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAssignments.map((assignment) => {
                  const isOnline = assignment.type === 'ONLINE_AUTO_GRADED';
                  const isPublished = assignment.status === 'PUBLISHED';
                  const isClosed = assignment.status === 'CLOSED';

                  return (
                      <div 
                        key={assignment.id}
                        className="group bg-slate-800/40 backdrop-blur-md border border-slate-700/50 hover:border-indigo-500/30 rounded-2xl p-5 transition-all flex flex-col"
                      >
                          <div className="flex items-start justify-between mb-4">
                              <div className={cn(
                                  "p-2.5 rounded-xl",
                                  isOnline ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"
                              )}>
                                  {isOnline ? <Wifi className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                              </div>
                              <div className={cn(
                                  "px-2.5 py-1 rounded-full text-xs font-bold border",
                                  isPublished ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                                  isClosed ? "bg-slate-700 text-slate-400 border-slate-600" :
                                  "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              )}>
                                  {assignment.status}
                              </div>
                          </div>

                          <div className="flex-1">
                              <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors">
                                  {assignment.title}
                              </h3>
                              
                              <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{assignment.classes?.name || 'Unknown Class'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  <span>{assignment.subjects?.name || 'Unknown Subject'}</span>
                              </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                  <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {format(new Date(assignment.due_date), 'MMM d, h:mm a')}
                                  </div>
                                  <div>
                                      {assignment.total_marks} Marks
                                  </div>
                              </div>

                              <div className="flex gap-2">
                                  <button 
                                    onClick={() => setGradingAssignment(assignment)}
                                    className="flex-1 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors hover:text-white"
                                  >
                                      View Submissions
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(assignment.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      {showWizard && (
          <AssignmentWizard 
            userId={userId} 
            onClose={() => setShowWizard(false)}
            onSuccess={() => {
                setShowWizard(false);
                fetchAssignments();
            }}
          />
      )}

      {gradingAssignment && (
          <AssignmentGradingView
             assignment={gradingAssignment}
             onClose={() => setGradingAssignment(null)}
          />
      )}
    </div>
  );
}
