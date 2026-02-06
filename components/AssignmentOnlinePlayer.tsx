'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Brain, Clock, Trophy, ArrowRight, ArrowLeft, 
  CheckCircle2, XCircle, Loader2, Flag, AlertTriangle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Question {
  id: string;
  question_text: string;
  question_type: 'MCQ' | 'SHORT_ANSWER' | 'TRUE_FALSE' | 'PARAGRAPH';
  marks: number;
  options?: any; // JSON string or object
  correct_answer: string;
}

interface AssignmentOnlinePlayerProps {
  assignment: any;
  studentId: string;
  onComplete: () => void;
}

export default function AssignmentOnlinePlayer({ 
  assignment, 
  studentId, 
  onComplete 
}: AssignmentOnlinePlayerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);

  useEffect(() => {
    loadAssignmentData();
  }, [assignment.id]);

  async function loadAssignmentData() {
    setLoading(true);
    try {
        // 1. Fetch Questions
        const { data: qData, error: qError } = await supabase
            .from('assignment_questions')
            .select('*')
            .eq('assignment_id', assignment.id)
            .order('order_index', { ascending: true });

        if (qError) throw qError;
      
        const parsedQuestions = qData?.map(q => ({
            ...q,
            options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
        }));
        setQuestions(parsedQuestions || []);

        // 2. Check for existing submission
        if (assignment.submission?.status === 'MARKED' || assignment.submission?.status === 'SUBMITTED') {
            const { data: sData, error: sError } = await supabase
                .from('submission_answers')
                .select('question_id, student_answer')
                .eq('submission_id', assignment.submission.id);

            if (sError) throw sError;

            // Load existing answers
            const loadedAnswers: Record<string, string> = {};
            if (sData && sData.length > 0) {
                sData.forEach(row => {
                    loadedAnswers[row.question_id] = row.student_answer;
                });
            } else if (parsedQuestions.length > 0) {
                 // Corrupted state: Submission exists but no answers saved (likely previous RLS error)
                 console.warn("Submission found but no answers saved.");
            }
            
            setAnswers(loadedAnswers);
            
            // Set state to Completed (Summary View) initially
            setScore(assignment.submission.score || 0);
            setCompleted(true);
            setIsReviewMode(true);
        }

    } catch (err) {
      console.error('Error loading assignment:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectAnswer = (qId: string, val: string) => {
      if (isReviewMode) return; // Read-only in review mode
      setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const calculateScore = () => {
      let total = 0;
      questions.forEach(q => {
          const userAns = answers[q.id];
          if (!userAns) return;

          // Check Correctness
          let isCorrect = false;
          if (q.question_type === 'SHORT_ANSWER') {
              isCorrect = userAns.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
          } else if (q.question_type === 'PARAGRAPH') {
               // Manual grading placeholder
               isCorrect = false; 
          } else {
              isCorrect = userAns === q.correct_answer;
          }

          if (isCorrect) total += q.marks;
      });
      return total;
  };

  const handleSubmit = async () => {
      if (!confirm("Are you sure you want to submit? You cannot undo this.")) return;
      
      setSubmitting(true);
      const finalScore = calculateScore();

      try {
          // 1. Create Submission Record
          const { data: submission, error: subError } = await supabase
            .from('student_submissions')
            .insert({
                assignment_id: assignment.id,
                student_id: studentId,
                status: 'MARKED', // Auto-graded immediately
                score: finalScore,
                submitted_at: new Date().toISOString()
            })
            .select()
            .single();

          if (subError) throw subError;

          // 2. Insert Answers Detail
          const answerRecords = questions.map(q => {
              const userAns = answers[q.id];
              let isCorrect = false;
               if (q.question_type === 'SHORT_ANSWER') {
                  isCorrect = userAns?.toLowerCase().trim() === q.correct_answer?.toLowerCase().trim();
              } else {
                  isCorrect = userAns === q.correct_answer;
              }

              return {
                  submission_id: submission.id,
                  question_id: q.id,
                  student_answer: userAns || '',
                  is_correct: isCorrect,
                  score_awarded: isCorrect ? q.marks : 0
              };
          });

          const { error: ansError } = await supabase
            .from('submission_answers')
            .insert(answerRecords);

          if (ansError) throw ansError;

          // Success
          setScore(finalScore);
          setCompleted(true);
          setIsReviewMode(true);
          
          if (finalScore / assignment.total_marks > 0.7) {
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          }

      } catch (err) {
          console.error('Error submitting quiz:', err);
          alert('Failed to submit. Please check your connection.');
      } finally {
          setSubmitting(false);
      }
  };

  const handleRetake = async () => {
      if (!confirm("Are you sure you want to retake entirely? Your previous score will be deleted.")) return;

      setSubmitting(true);
      try {
          if (assignment.submission?.id) {
              const { error } = await supabase
                  .from('student_submissions')
                  .delete()
                  .eq('id', assignment.submission.id);
              
              if (error) throw error;
          }

          // Reset State
          setAnswers({});
          setScore(0);
          setCompleted(false);
          setIsReviewMode(false);
          setCurrentQIndex(0);
          
          // Re-load questions to be fresh
          await loadAssignmentData();

      } catch (err) {
          console.error("Error retaking:", err);
          alert("Could not reset assignment. Please try again.");
      } finally {
          setSubmitting(false);
      }
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  // Render Summary Screen
  if (completed && currentQIndex === -1) { // We use -1 for summary view while navigating in review
      // Actually simpler: If completed is true, show summary. Review button sets completed=false but keeps isReviewMode=true?
      // No, let's keep completed=true for the final state.
      // Let's toggle between "Summary" and "Review Questions" using a local UI state? 
      // Or just navigate.
  }
  
  if (completed) {
      return (
        <div className="max-w-xl mx-auto text-center py-12 space-y-6 animate-in zoom-in-50 duration-500">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                <Trophy className="w-12 h-12 text-white" />
            </div>
            
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">{isReviewMode ? "Assignment Result" : "Quiz Completed!"}</h2>
                <p className="text-slate-400">
                    {isReviewMode ? "You have already completed this assignment." : "Your assignment has been submitted successfully."}
                </p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
                 <div className="text-sm text-slate-400 uppercase font-bold tracking-wider mb-2">You Scored</div>
                 <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
                     {score} / {assignment.total_marks}
                 </div>
                 <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                     {Math.round((score / assignment.total_marks) * 100)}%
                 </div>
            </div>

            <div className="grid gap-3">
                <button 
                   onClick={() => setCompleted(false)} // Go to Question View (Review Mode)
                   className="w-full px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                    <Brain className="w-5 h-5" /> Review Answers
                </button>

                <button 
                   onClick={handleRetake}
                   disabled={submitting}
                   className="w-full px-8 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl font-bold transition-all border border-white/10"
                >
                   {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Retake Assignment"}
                </button>

                <button 
                   onClick={onComplete}
                   className="px-8 py-3 text-slate-400 hover:text-white font-medium transition-all"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
      );
  }

  const currentQ = questions[currentQIndex];
  const progress = ((currentQIndex + 1) / questions.length) * 100;
  
  // Checking correct answer for review
  const userAnswer = answers[currentQ.id];
  const isCorrect = userAnswer === currentQ.correct_answer; 
  // Note: Short answer comparison might be simple here, for review visual mostly

  return (
    <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <div>
                 <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">{assignment.title}</h1>
                    {isReviewMode && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                            REVIEW MODE
                        </span>
                    )}
                 </div>
                 <div className="flex items-center gap-4 text-sm text-slate-400">
                     <span className="flex items-center gap-1"><Brain className="w-4 h-4" /> {questions.length} Questions</span>
                     <span className="flex items-center gap-1"><Trophy className="w-4 h-4" /> {assignment.total_marks} Marks</span>
                 </div>
            </div>
             <div className="text-right">
                 <div className="text-3xl font-mono font-bold text-slate-200">
                     {String(currentQIndex + 1).padStart(2, '0')}<span className="text-slate-600 text-lg">/{questions.length}</span>
                 </div>
             </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 rounded-full mb-8 overflow-hidden relative">
            <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>

        {isReviewMode && Object.keys(answers).length === 0 && questions.length > 0 && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/50 rounded-xl flex items-center gap-3 text-amber-200">
                <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
                <p className="text-sm font-medium">
                    Warning: No answers were found for this submission. This likely occurred due to a previous system error. 
                    Please click <span className="font-bold underline">Retake Assignment</span> to submit properly.
                </p>
            </div>
        )}

        {/* Question Card */}
        <div className={cn(
            "bg-slate-800/50 backdrop-blur-xl border rounded-3xl p-8 min-h-[400px] flex flex-col transition-colors duration-300",
            isReviewMode 
                ? isCorrect ? "border-emerald-500/30 bg-emerald-950/20" : "border-red-500/30 bg-red-950/20"
                : "border-slate-700/50"
        )}>
             <div className="flex-1">
                 <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold uppercase">
                            {currentQ.question_type.replace('_', ' ')}
                        </span>
                        <span className="text-slate-500 text-xs font-bold">{currentQ.marks} Marks</span>
                     </div>
                     
                     {isReviewMode && (
                         <div className={cn(
                             "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold",
                             isCorrect ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                         )}>
                             {isCorrect ? <><CheckCircle2 className="w-4 h-4" /> Correct</> : <><XCircle className="w-4 h-4" /> Incorrect</>}
                         </div>
                     )}
                 </div>

                 <h3 className="text-2xl font-medium text-white leading-relaxed mb-8">
                     {currentQ.question_text}
                 </h3>

                 <div className="space-y-3 max-w-2xl">
                     {currentQ.question_type === 'MCQ' && currentQ.options?.map((opt: any, idx: number) => {
                         const isSelected = answers[currentQ.id] === opt.label;
                         const isOptCorrect = opt.label === currentQ.correct_answer;
                         if (isReviewMode) {
                             console.log(`Q: ${currentQ.id}, Opt: ${opt.label}, Correct: ${currentQ.correct_answer}, IsCorrect: ${isOptCorrect}`);
                         }
                         
                         let stateStyles = "bg-slate-900/50 border-slate-700 hover:border-slate-500";
                         if (isSelected) stateStyles = "bg-indigo-500/20 border-indigo-500";
                         
                         if (isReviewMode) {
                             if (isOptCorrect) stateStyles = "bg-emerald-500/20 border-emerald-500";
                             else if (isSelected && !isOptCorrect) stateStyles = "bg-red-500/20 border-red-500";
                             else stateStyles = "bg-slate-900/50 border-slate-800 opacity-50";
                         }

                         return (
                          <div 
                             key={idx}
                             onClick={() => handleSelectAnswer(currentQ.id, opt.label)}
                             className={cn(
                                 "cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 group",
                                 stateStyles
                             )}
                          >
                              <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors",
                                  isReviewMode && isOptCorrect ? "bg-emerald-500 text-white" :
                                  isReviewMode && isSelected && !isOptCorrect ? "bg-red-500 text-white" :
                                  isSelected ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400"
                              )}>
                                  {opt.label}
                              </div>
                              <span className={cn(
                                  "font-medium",
                                  "text-slate-300",
                                  (isSelected || (isReviewMode && isOptCorrect)) && "text-white"
                              )}>
                                  {opt.value}
                              </span>
                          </div>
                      );})}

                     {currentQ.question_type === 'TRUE_FALSE' && (
                         <div className="grid grid-cols-2 gap-4">
                             {['True', 'False'].map((val) => {
                                 const isSelected = answers[currentQ.id] === val;
                                 const isOptCorrect = val === currentQ.correct_answer;

                                 let stateStyles = "bg-slate-900/50 border-slate-700 text-slate-400";
                                 if (isSelected) stateStyles = val === 'True' ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-red-500/20 border-red-500 text-red-400";
                                 
                                 if (isReviewMode) {
                                      if (isOptCorrect) stateStyles = "bg-emerald-500/20 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/50";
                                      else if (isSelected && !isOptCorrect) stateStyles = "bg-red-500/20 border-red-500 text-red-400 opacity-50";
                                      else stateStyles = "bg-slate-900/30 border-slate-800 text-slate-600 opacity-30";
                                 }

                                 return (
                                 <button
                                     key={val}
                                     onClick={() => handleSelectAnswer(currentQ.id, val)}
                                     disabled={isReviewMode}
                                     className={cn(
                                         "p-6 rounded-xl border-2 font-bold text-lg transition-all",
                                         stateStyles
                                     )}
                                 >
                                     {val}
                                 </button>
                             );})}
                         </div>
                     )}

                     {(currentQ.question_type === 'SHORT_ANSWER' || currentQ.question_type === 'PARAGRAPH') && (
                         <div className="space-y-4">
                            <textarea 
                                value={answers[currentQ.id] || ''}
                                onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                                placeholder="Type your answer here..."
                                rows={4}
                                disabled={isReviewMode}
                                className={cn(
                                    "w-full bg-slate-900/50 border rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transaction-all text-lg",
                                    isReviewMode 
                                        ? isCorrect ? "border-emerald-500/50 bg-emerald-900/10" : "border-red-500/50 bg-red-900/10"
                                        : "border-slate-700"
                                )}
                            />
                            {isReviewMode && !isCorrect && (
                                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
                                    <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Correct Answer</div>
                                    <div className="text-emerald-100">{currentQ.correct_answer}</div>
                                </div>
                            )}
                         </div>
                     )}
                 </div>
             </div>

             {/* Footer Nav */}
             <div className="flex items-center justify-between pt-8 border-t border-slate-700/50 mt-8">
                 <button 
                    onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQIndex === 0}
                    className="flex items-center gap-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium px-4 py-2 rounded-lg hover:bg-white/5"
                 >
                     <ArrowLeft className="w-4 h-4" /> Prev
                 </button>

                 {currentQIndex < questions.length - 1 ? (
                     <button 
                        onClick={() => setCurrentQIndex(prev => prev + 1)}
                        className="bg-white text-slate-900 hover:bg-slate-200 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-white/10"
                     >
                         Next Question <ArrowRight className="w-4 h-4" />
                     </button>
                 ) : (
                     isReviewMode ? (
                        <button 
                            onClick={() => setCompleted(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            Back to Summary
                        </button>
                     ) : (
                        <button 
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-70 disabled:cursor-wait"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                            Submit Quiz
                        </button>
                     )
                 )}
             </div>
        </div>
    </div>
  );
}
