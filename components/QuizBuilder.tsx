'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus, X, Trash2, Loader, Brain, Clock, Trophy, GripVertical, CheckCircle2,
  Circle, Type, ListChecks, Calendar, Eye, Edit3, Copy, BarChart3, Users, Sparkles, Target, Zap, LayoutGrid, Save, ArrowLeft, MoreVertical
} from 'lucide-react';
import { toast } from 'sonner';

const supabase = createClient();

interface QuizQuestion {
  id?: string;
  quiz_id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  options: string[];
  correct_answer: string;
  marks: number;
  order_index: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  duration_minutes: number | null;
  points_per_question: number;
  is_published: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  created_by: string;
  questions?: QuizQuestion[];
  attempt_count?: number;
  avg_score?: number;
}

interface QuizBuilderProps {
  userId: string;
  onClose: () => void;
}

// Utility for time conversion
function formatForDatetimeLocal(isoStr: string | null) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QuizBuilder({ userId, onClose }: QuizBuilderProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, [userId]);

  async function fetchQuizzes() {
    try {
      setLoading(true);
      const { data: quizzesData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (quizzesData) {
        const quizzesWithStats = await Promise.all(
          quizzesData.map(async (quiz: Quiz) => {
            const { data: attempts } = await supabase
              .from('quiz_attempts')
              .select('score')
              .eq('quiz_id', quiz.id)
              .eq('completed', true);

            return {
              ...quiz,
              attempt_count: attempts?.length || 0,
              avg_score: attempts?.length 
                ? Math.round(attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length) 
                : 0
            };
          })
        );
        setQuizzes(quizzesWithStats);
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function togglePublish(quiz: Quiz) {
    try {
      await supabase
        .from('quizzes')
        .update({ is_published: !quiz.is_published })
        .eq('id', quiz.id);
      fetchQuizzes();
      toast.success(quiz.is_published ? 'Quiz unpublished' : 'Quiz published successfully');
    } catch (err) {
      console.error('Error toggling publish:', err);
      toast.error('Failed to update quiz status');
    }
  }

  async function deleteQuiz(quiz: Quiz) {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) return;
    try {
      await supabase.from('quiz_questions').delete().eq('quiz_id', quiz.id);
      await supabase.from('quiz_attempts').delete().eq('quiz_id', quiz.id);
      await supabase.from('quizzes').delete().eq('id', quiz.id);
      fetchQuizzes();
      toast.success('Quiz deleted');
    } catch (err) {
      console.error('Error deleting quiz:', err);
      toast.error('Failed to delete quiz');
    }
  }

  return (
    <div className={`bg-slate-900 rounded-2xl shadow-2xl p-4 md:p-8 mb-8 border border-white/10 relative ${view === 'editor' ? 'min-h-[80vh] flex flex-col' : ''}`}>
      {view === 'list' && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Quiz Builder</h2>
              <p className="text-sm text-gray-400">Create engaging quizzes for your students</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 transition-colors rounded-lg hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : view === 'list' ? (
        <div className="space-y-4">
          <button
            onClick={() => { setSelectedQuiz(null); setView('editor'); }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-3 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-amber-500/25"
          >
            <Plus className="w-5 h-5" />
            Create New Quiz
          </button>

          {quizzes.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
              <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Quizzes Yet</h3>
              <p className="text-gray-400 mb-6">Create your first quiz to engage students with interactive learning</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white truncate">{quiz.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${quiz.is_published ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {quiz.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      {quiz.description && <p className="text-gray-400 text-sm mb-3 line-clamp-1">{quiz.description}</p>}
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {quiz.duration_minutes && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Clock className="w-4 h-4" /> {quiz.duration_minutes} min
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-gray-400">
                          <Trophy className="w-4 h-4" /> {quiz.points_per_question} pts/q
                        </span>
                        <span className="flex items-center gap-1 text-gray-400">
                          <Users className="w-4 h-4" /> {quiz.attempt_count} attempts
                        </span>
                        {quiz.attempt_count! > 0 && (
                          <span className="flex items-center gap-1 text-violet-400">
                            <BarChart3 className="w-4 h-4" /> Avg: {quiz.avg_score}%
                          </span>
                        )}
                      </div>
                      {quiz.scheduled_start && (
                        <div className="mt-2 flex items-center gap-1 text-amber-400 text-sm">
                          <Calendar className="w-4 h-4" />
                          {new Date(quiz.scheduled_start).toLocaleString()}
                          {quiz.scheduled_end && ` - ${new Date(quiz.scheduled_end).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedQuiz(quiz); setView('editor'); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Edit">
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button onClick={() => togglePublish(quiz)} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${quiz.is_published ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                        {quiz.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => deleteQuiz(quiz)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Delete">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <QuizForm 
          userId={userId} 
          initialQuiz={selectedQuiz} 
          onBack={() => { setView('list'); fetchQuizzes(); }} 
        />
      )}
    </div>
  );
}

// ==========================================
// FULLY RESPONSIVE QUIZ FORM (3-PANEL)
// ==========================================
function QuizForm({ userId, initialQuiz, onBack }: { userId: string; initialQuiz: Quiz | null; onBack: () => void }) {
  // Settings State
  const [title, setTitle] = useState(initialQuiz?.title || '');
  const [description, setDescription] = useState(initialQuiz?.description || '');
  const [timeLimit, setTimeLimit] = useState<number | ''>(initialQuiz?.duration_minutes || '');
  const [pointsPerQuestion, setPointsPerQuestion] = useState(initialQuiz?.points_per_question || 10);
  const [scheduledStart, setScheduledStart] = useState(formatForDatetimeLocal(initialQuiz?.scheduled_start || null));
  const [scheduledEnd, setScheduledEnd] = useState(formatForDatetimeLocal(initialQuiz?.scheduled_end || null));

  // Questions State
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Auto-save logic
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // References for scrolling
  const listRef = useRef<HTMLDivElement>(null);

  // Persist the quiz ID across re-renders — using let caused auto-save to always INSERT instead of UPDATE
  const activeQuizIdRef = useRef<string | null>(initialQuiz?.id || null);
  // Guard against double-click publish race condition
  const isPublishingRef = useRef(false);

  useEffect(() => {
    if (initialQuiz) {
      loadQuestions();
    } else {
      // Add one empty question by default
      addQuestion('multiple_choice');
    }
  }, []);

  async function loadQuestions() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', initialQuiz!.id)
        .order('order_index', { ascending: true });
        
      if (data) {
        setQuestions(data.map((q: any) => ({ ...q, options: q.options || [] })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Auto-Save Effect
  useEffect(() => {
    if (!title.trim() || questions.length === 0 || !hasUnsavedChanges) return;
    
    const timeout = setTimeout(() => {
      handleSave(false, true); // silent save
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [title, description, timeLimit, pointsPerQuestion, scheduledStart, scheduledEnd, questions, hasUnsavedChanges]);

  function markUnsaved() {
    setHasUnsavedChanges(true);
  }

  function addQuestion(type: 'multiple_choice' | 'true_false' | 'short_answer', insertAfterIndex?: number) {
    const newQuestion: QuizQuestion = {
      id: crypto.randomUUID(),
      question_text: '',
      question_type: type,
      options: type === 'multiple_choice' ? ['', '', '', ''] : type === 'true_false' ? ['True', 'False'] : [],
      correct_answer: type === 'true_false' ? 'True' : '',
      marks: pointsPerQuestion,
      order_index: questions.length
    };

    let newQuestions = [...questions];
    if (typeof insertAfterIndex === 'number') {
      newQuestions.splice(insertAfterIndex + 1, 0, newQuestion);
    } else {
      newQuestions.push(newQuestion);
    }
    
    // Re-index
    newQuestions = newQuestions.map((q, idx) => ({ ...q, order_index: idx }));
    setQuestions(newQuestions);
    markUnsaved();

    // Scroll to new question (delay slightly to allow DOM to render)
    setTimeout(() => {
      const qElements = document.querySelectorAll('.question-card');
      const targetIdx = typeof insertAfterIndex === 'number' ? insertAfterIndex + 1 : newQuestions.length - 1;
      if (qElements[targetIdx]) {
        qElements[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  function duplicateQuestion(index: number) {
    const q = questions[index];
    const newQuestion: QuizQuestion = {
      ...q,
      id: crypto.randomUUID(),
      question_text: q.question_text + ' (Copy)'
    };
    
    let newQuestions = [...questions];
    newQuestions.splice(index + 1, 0, newQuestion);
    newQuestions = newQuestions.map((q, idx) => ({ ...q, order_index: idx }));
    setQuestions(newQuestions);
    markUnsaved();
    
    setTimeout(() => {
      const qElements = document.querySelectorAll('.question-card');
      if (qElements[index + 1]) {
        qElements[index + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  function updateQuestion(index: number, updates: Partial<QuizQuestion>) {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
    markUnsaved();
  }

  function removeQuestion(index: number) {
    let updated = questions.filter((_, i) => i !== index);
    updated = updated.map((q, idx) => ({ ...q, order_index: idx }));
    setQuestions(updated);
    markUnsaved();
  }

  // Core Save Logic
  async function handleSave(publish: boolean = false, isAutoSave: boolean = false) {
    if (!title.trim()) {
      if (!isAutoSave) toast.error('Quiz title is required');
      return;
    }

    // Guard: prevent concurrent publish calls (double-click protection)
    if (publish && isPublishingRef.current) return;
    if (publish) isPublishingRef.current = true;
    
    setIsSaving(true);
    try {
      // Handle proper timezone mapping for scheduled dates
      const startDateTime = scheduledStart ? new Date(scheduledStart).toISOString() : null;
      const endDateTime = scheduledEnd ? new Date(scheduledEnd).toISOString() : null;

      const quizData = {
        title,
        description,
        duration_minutes: timeLimit || null,
        points_per_question: pointsPerQuestion,
        is_published: publish,
        scheduled_start: startDateTime,
        scheduled_end: endDateTime,
        created_by: userId
      };

      // Use the ref — persists across re-renders unlike a plain let variable
      if (activeQuizIdRef.current) {
        // Update existing quiz
        await supabase.from('quizzes').update(quizData).eq('id', activeQuizIdRef.current);
        await supabase.from('quiz_questions').delete().eq('quiz_id', activeQuizIdRef.current);
      } else {
        // Create new quiz (only happens once on first save)
        const { data: newQuiz, error } = await supabase.from('quizzes').insert([quizData]).select().single();
        if (error) throw error;
        activeQuizIdRef.current = newQuiz.id; // store in ref so all future saves UPDATE, never INSERT
      }

      // Insert questions
      if (questions.length > 0) {
        const questionsToInsert = questions.map(q => ({
          quiz_id: activeQuizIdRef.current,
          question_text: q.question_text || 'Untitled Question',
          question_type: q.question_type,
          options: q.options.filter(o => o.trim()),
          correct_answer: q.correct_answer,
          marks: q.marks,
          order_index: q.order_index
        }));
        await supabase.from('quiz_questions').insert(questionsToInsert);
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      
      if (!isAutoSave) {
        toast.success(publish ? 'Quiz published!' : 'Quiz saved!');
        if (publish) onBack(); // return to list if explicitly published
      }
    } catch (err) {
      console.error(err);
      if (!isAutoSave) toast.error('Failed to save quiz');
    } finally {
      setIsSaving(false);
      if (publish) isPublishingRef.current = false;
    }
  }

  const QuestionTools = () => (
    <div className="flex flex-col gap-2">
      <button onClick={() => addQuestion('multiple_choice')} className="flex items-center gap-3 px-4 py-3 bg-violet-500/10 text-violet-400 rounded-xl hover:bg-violet-500/20 transition-all font-medium text-left">
        <ListChecks className="w-5 h-5 shrink-0" />
        <span>Multiple Choice</span>
      </button>
      <button onClick={() => addQuestion('true_false')} className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all font-medium text-left">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <span>True / False</span>
      </button>
      <button onClick={() => addQuestion('short_answer')} className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all font-medium text-left">
        <Type className="w-5 h-5 shrink-0" />
        <span>Short Answer</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full absolute inset-0 md:p-8 p-4">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white truncate max-w-[200px] md:max-w-md">
              {title || 'Untitled Quiz'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              {isSaving ? (
                <>
                  <Loader className="w-3 h-3 animate-spin" /> Saving...
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <Circle className="w-3 h-3 fill-amber-500 text-amber-500" /> Unsaved changes
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Saved at {lastSaved.toLocaleTimeString()}
                </>
              ) : (
                <>Ready</>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => handleSave(false)} className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all text-sm">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={() => handleSave(true)} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white rounded-lg font-bold transition-all shadow-lg text-sm">
            Publish
          </button>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
        
        {/* Left Panel: Settings */}
        <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-4">
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Title <span className="text-red-400">*</span></label>
                <input type="text" placeholder="Quiz Title" value={title} onChange={e => { setTitle(e.target.value); markUnsaved(); }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea rows={2} placeholder="Optional" value={description} onChange={e => { setDescription(e.target.value); markUnsaved(); }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-500 outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Duration (Min)</label>
                  <input type="number" placeholder="None" value={timeLimit} onChange={e => { setTimeLimit(parseInt(e.target.value) || ''); markUnsaved(); }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Pts / Q</label>
                  <input type="number" value={pointsPerQuestion} onChange={e => { setPointsPerQuestion(parseInt(e.target.value) || 10); markUnsaved(); }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Scheduled Start</label>
                <input type="datetime-local" value={scheduledStart} onChange={e => { setScheduledStart(e.target.value); markUnsaved(); }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Scheduled End</label>
                <input type="datetime-local" value={scheduledEnd} onChange={e => { setScheduledEnd(e.target.value); markUnsaved(); }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-500 outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel: Questions Builder */}
        <div className="flex-1 shrink-0 lg:max-w-3xl flex flex-col gap-6" ref={listRef}>
          {loading ? (
            <div className="flex justify-center p-12"><Loader className="w-8 h-8 text-amber-500 animate-spin" /></div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id!} className="question-card flex flex-col gap-2 relative group">
                {/* Question Block */}
                <QuestionEditor
                  question={q}
                  index={idx}
                  onUpdate={(updates) => updateQuestion(idx, updates)}
                  onDuplicate={() => duplicateQuestion(idx)}
                  onRemove={() => removeQuestion(idx)}
                />

                {/* Inline Add Button (Always visible on mobile, hover/focus on desktop) */}
                <div className="flex justify-center flex-col items-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity mt-2 z-10 w-full">
                   <div className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mb-2 opacity-50">+ Add Question Below</div>
                   <div className="bg-slate-800 border border-white/10 rounded-full px-2 py-1 shadow-xl flex gap-1">
                      <button onClick={() => addQuestion('multiple_choice', idx)} className="p-2 hover:bg-violet-500/20 text-violet-400 rounded-full transition-colors flex gap-2 items-center" title="Add Multiple Choice"><ListChecks className="w-4 h-4"/> <span className="text-xs font-semibold pr-2 hidden md:inline">Multiple Choice</span></button>
                      <button onClick={() => addQuestion('true_false', idx)} className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-full transition-colors flex gap-2 items-center" title="Add True/False"><CheckCircle2 className="w-4 h-4"/> <span className="text-xs font-semibold pr-2 hidden md:inline">True / False</span></button>
                      <button onClick={() => addQuestion('short_answer', idx)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-full transition-colors flex gap-2 items-center" title="Add Short Answer"><Type className="w-4 h-4"/> <span className="text-xs font-semibold pr-2 hidden md:inline">Short Answer</span></button>
                   </div>
                </div>
              </div>
            ))
          )}

          {questions.length === 0 && !loading && (
            <div className="text-center py-16 bg-white/5 rounded-2xl border border-dashed border-white/20">
              <LayoutGrid className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">Build Your Quiz</h3>
              <p className="text-gray-400 mb-6 text-sm">Add questions from the tools menu to start</p>
            </div>
          )}
          
          <div className="h-10"></div> {/* Bottom padding */}
        </div>

        {/* Right Panel: Floating Toolbar (Desktop) */}
        <div className="hidden lg:block w-[240px] shrink-0">
          <div className="sticky top-0 bg-slate-800/80 backdrop-blur-md rounded-xl p-5 border border-white/10 shadow-xl">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" /> Add Blocks
            </h3>
            <QuestionTools />
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Questions</span>
                <span className="font-bold text-white max-w-16 truncate text-right">{questions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Points</span>
                <span className="font-bold text-white max-w-16 truncate text-right">{questions.reduce((a, b) => a + b.marks, 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Action Bar (FAB) */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
        {/* Actions (always visible on mobile) */}
        <div className="flex flex-col gap-2 pointer-events-auto items-end">
          <button onClick={() => handleSave(true)} className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white rounded-full font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] text-sm transition-transform active:scale-95 text-center">
            Publish Quiz
          </button>
          <button onClick={() => handleSave(false)} className="px-6 py-2 bg-slate-800 border border-white/20 text-white rounded-full font-medium shadow-xl text-sm transition-transform active:scale-95 text-center">
             Save Draft
          </button>
        </div>
        
        {/* Tools Menu */}
        <div className="group relative mt-2 pointer-events-auto flex justify-end w-full">
          <div className="absolute bottom-16 right-0 bg-slate-800 border border-white/10 rounded-xl p-2 shadow-2xl flex-col gap-2 hidden group-hover:flex w-[200px]">
             <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 px-2">Add Questions</div>
             <QuestionTools />
          </div>
          <button className="w-14 h-14 bg-violet-600 rounded-full shadow-[0_0_15px_rgba(124,58,237,0.5)] flex items-center justify-center text-white hover:scale-105 transition-transform" title="Add Blocks">
            <Plus className="w-8 h-8" />
          </button>
        </div>
      </div>

    </div>
  );
}

// Ensure the Question Editor does not re-render unnecessarily 
const QuestionEditor = memo(function QuestionEditor({
  question, index, onUpdate, onDuplicate, onRemove
}: {
  question: QuizQuestion;
  index: number;
  onUpdate: (updates: Partial<QuizQuestion>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const typeColors = { multiple_choice: 'violet', true_false: 'emerald', short_answer: 'blue' };
  const typeIcons = { multiple_choice: ListChecks, true_false: CheckCircle2, short_answer: Type };
  const TypeIcon = typeIcons[question.question_type];
  const color = typeColors[question.question_type];

  // Option updater helper
  const updateOption = (optIndex: number, val: string) => {
    const newOptions = [...question.options];
    newOptions[optIndex] = val;
    onUpdate({ options: newOptions });
  };

  return (
    <div className={`bg-slate-800/90 rounded-2xl border border-white/10 overflow-hidden shadow-lg transition-all focus-within:border-${color}-500/50 focus-within:shadow-[0_0_20px_rgba(0,0,0,0.3)]`}>
      <div className={`px-4 md:px-6 py-3 bg-${color}-500/10 border-b border-white/5 flex items-center justify-between`}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`w-8 h-8 bg-${color}-500/20 rounded-lg flex items-center justify-center shrink-0`}>
            <TypeIcon className={`w-4 h-4 text-${color}-400`} />
          </div>
          <span className="font-bold text-white text-sm md:text-base whitespace-nowrap">Q{index + 1}</span>
          <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-${color}-500/20 text-${color}-400 font-bold uppercase tracking-wider hidden sm:inline-block`}>
            {question.question_type.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <div className="flex items-center bg-black/20 rounded-lg px-2 py-1">
            <Trophy className="w-3 h-3 text-amber-400 mr-1" />
            <input type="number" value={question.marks} onChange={e => onUpdate({ marks: parseInt(e.target.value) || 0 })} className="w-8 md:w-10 bg-transparent text-white text-xs md:text-sm text-center outline-none font-bold" />
            <span className="text-gray-400 text-xs hidden md:inline">pts</span>
          </div>
          <div className="h-4 w-px bg-white/10 mx-1"></div>
          
          <button onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Duplicate">
            <Copy className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Delete">
            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-5">
        <textarea
          placeholder="Type your question here..."
          value={question.question_text}
          onChange={e => onUpdate({ question_text: e.target.value })}
          rows={2}
          className="w-full bg-transparent text-white text-base md:text-lg placeholder-gray-500/50 focus:outline-none resize-none font-medium"
        />

        {question.question_type === 'multiple_choice' && (
          <div className="space-y-2 mt-4">
            {question.options.map((option, optIdx) => (
              <div key={optIdx} className="flex items-start sm:items-center gap-2 sm:gap-3 group/opt w-full">
                <button
                  onClick={() => onUpdate({ correct_answer: option })}
                  className={`mt-2 sm:mt-0 shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    question.correct_answer === option && option.trim() ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {question.correct_answer === option && option.trim() && <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                </button>
                <textarea
                  placeholder={`Option ${optIdx + 1}`}
                  value={option}
                  rows={1}
                  onChange={e => updateOption(optIdx, e.target.value)}
                  className={`flex-1 w-full min-h-[40px] px-3 py-2 bg-white/5 border rounded-lg text-white text-sm outline-none transition-all resize-y ${
                    question.correct_answer === option && option.trim() ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-transparent focus:border-white/20'
                  }`}
                />
                <button onClick={() => {
                  const newOpts = [...question.options];
                  newOpts.splice(optIdx, 1);
                  onUpdate({ options: newOpts });
                }} className="opacity-0 group-hover/opt:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {question.options.length < 6 && (
              <button
                onClick={() => onUpdate({ options: [...question.options, ''] })}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 ml-9 mt-2 p-1 px-2 rounded-lg hover:bg-violet-500/10"
              >
                <Plus className="w-3 h-3" /> Add Option
              </button>
            )}
          </div>
        )}

        {question.question_type === 'true_false' && (
          <div className="flex gap-4 mt-4">
            {['True', 'False'].map(opt => (
              <button
                key={opt}
                onClick={() => onUpdate({ correct_answer: opt })}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                  question.correct_answer === opt
                    ? opt === 'True' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-red-500/20 text-red-400 border-red-500'
                    : 'bg-white/5 text-gray-400 border-transparent hover:border-white/20'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {question.question_type === 'short_answer' && (
          <div className="mt-4">
            <input
              type="text"
              placeholder="Enter the correct answer"
              value={question.correct_answer}
              onChange={e => onUpdate({ correct_answer: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all font-medium"
            />
          </div>
        )}
      </div>
    </div>
  );
});
