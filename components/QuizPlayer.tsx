'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Brain,
  Clock,
  Trophy,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Loader,
  Sparkles,
  Target,
  Zap,
  Star,
  Medal,
  Flag
} from 'lucide-react';
import confetti from 'canvas-confetti';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  time_limit_minutes: number | null;
  points_per_question: number;
  is_published: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
}

interface QuizPlayerProps {
  quizId: string;
  studentName: string;
  onComplete: (score: number, totalPoints: number) => void;
  onExit: () => void;
}

export default function QuizPlayer({ quizId, studentName, onComplete, onExit }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quizState, setQuizState] = useState<'loading' | 'ready' | 'playing' | 'reviewing' | 'completed'>('loading');
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quizState === 'playing' && timeRemaining !== null && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev && prev <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [quizState, timeRemaining]);

  async function loadQuiz() {
    try {
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (quizData) {
        setQuiz(quizData);
        if (quizData.time_limit_minutes) {
          setTimeRemaining(quizData.time_limit_minutes * 60);
        }
      }

      const { data: questionsData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      if (questionsData) {
        setQuestions(questionsData);
      }

      setQuizState('ready');
    } catch (err) {
      console.error('Error loading quiz:', err);
    } finally {
      setLoading(false);
    }
  }

  async function startQuiz() {
    // Create attempt record
    const { data: attempt } = await supabase
      .from('quiz_attempts')
      .insert([{
        quiz_id: quizId,
        student_name: studentName,
        started_at: new Date().toISOString(),
        completed: false
      }])
      .select()
      .single();

    if (attempt) {
      setAttemptId(attempt.id);
    }

    setQuizState('playing');
  }

  function selectAnswer(questionId: string, answer: string) {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }

  function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  }

  function prevQuestion() {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  }

  const handleSubmit = useCallback(async () => {
    if (quizState === 'completed') return;
    
    // Calculate score
    let totalScore = 0;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    for (const question of questions) {
      const userAnswer = answers[question.id];
      if (userAnswer) {
        const isCorrect = question.question_type === 'short_answer'
          ? userAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim()
          : userAnswer === question.correct_answer;
        
        if (isCorrect) {
          totalScore += question.points;
        }
      }
    }

    setScore(totalScore);
    setQuizState('completed');
    setShowResult(true);

    // Update attempt record
    if (attemptId) {
      const percentageScore = Math.round((totalScore / totalPoints) * 100);
      await supabase
        .from('quiz_attempts')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          score: percentageScore,
          points_earned: totalScore,
          answers: answers,
          time_taken_seconds: quiz?.time_limit_minutes 
            ? (quiz.time_limit_minutes * 60) - (timeRemaining || 0)
            : null
        })
        .eq('id', attemptId);

      // Update leaderboard
      const { data: existingEntry } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('student_name', studentName)
        .single();

      if (existingEntry) {
        await supabase
          .from('leaderboard')
          .update({
            total_points: existingEntry.total_points + totalScore,
            quizzes_completed: existingEntry.quizzes_completed + 1,
            average_score: Math.round(
              ((existingEntry.average_score * existingEntry.quizzes_completed) + percentageScore) / 
              (existingEntry.quizzes_completed + 1)
            )
          })
          .eq('id', existingEntry.id);
      } else {
        await supabase
          .from('leaderboard')
          .insert([{
            student_name: studentName,
            total_points: totalScore,
            quizzes_completed: 1,
            average_score: percentageScore
          }]);
      }
    }

    // Celebration effect
    if (totalScore / totalPoints >= 0.7) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    onComplete(totalScore, totalPoints);
  }, [quizState, questions, answers, attemptId, quiz, timeRemaining, studentName, onComplete]);

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-amber-400 animate-spin" />
          <p className="text-white font-medium">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Not Found</h2>
          <p className="text-gray-400 mb-6">This quiz may have been removed or is not available.</p>
          <button onClick={onExit} className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Ready state
  if (quizState === 'ready') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/25">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">{quiz.title}</h1>
          {quiz.description && (
            <p className="text-gray-400 mb-6">{quiz.description}</p>
          )}
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4">
              <Target className="w-6 h-6 text-violet-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{questions.length}</p>
              <p className="text-sm text-gray-400">Questions</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{questions.reduce((sum, q) => sum + q.points, 0)}</p>
              <p className="text-sm text-gray-400">Total Points</p>
            </div>
            {quiz.time_limit_minutes && (
              <div className="col-span-2 bg-white/5 rounded-xl p-4">
                <Clock className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{quiz.time_limit_minutes} minutes</p>
                <p className="text-sm text-gray-400">Time Limit</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={startQuiz}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Start Quiz
            </button>
            <button
              onClick={onExit}
              className="w-full py-3 bg-white/10 text-gray-300 rounded-xl font-medium hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completed state
  if (quizState === 'completed' && showResult) {
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const percentage = Math.round((score / totalPoints) * 100);
    const isPassing = percentage >= 70;

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isPassing 
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25' 
              : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25'
          }`}>
            {isPassing ? (
              <Trophy className="w-12 h-12 text-white" />
            ) : (
              <Target className="w-12 h-12 text-white" />
            )}
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {isPassing ? 'Excellent Work!' : 'Quiz Complete!'}
          </h1>
          <p className="text-gray-400 mb-8">
            {isPassing 
              ? 'You demonstrated great knowledge!' 
              : 'Keep practicing to improve your score!'}
          </p>

          <div className="bg-white/5 rounded-2xl p-6 mb-8">
            <div className="text-6xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-2">
              {percentage}%
            </div>
            <p className="text-gray-400">
              {score} / {totalPoints} points
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-white">
                {questions.filter(q => {
                  const ans = answers[q.id];
                  return ans && (q.question_type === 'short_answer' 
                    ? ans.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
                    : ans === q.correct_answer);
                }).length}
              </p>
              <p className="text-xs text-gray-400">Correct</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
              <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-white">
                {questions.filter(q => {
                  const ans = answers[q.id];
                  return !ans || (q.question_type === 'short_answer' 
                    ? ans.toLowerCase().trim() !== q.correct_answer.toLowerCase().trim()
                    : ans !== q.correct_answer);
                }).length}
              </p>
              <p className="text-xs text-gray-400">Incorrect</p>
            </div>
            <div className="bg-violet-500/10 rounded-xl p-4 border border-violet-500/20">
              <Star className="w-6 h-6 text-violet-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-white">+{score}</p>
              <p className="text-xs text-gray-400">Points</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setShowResult(false);
                setQuizState('reviewing');
              }}
              className="w-full py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <Target className="w-5 h-5" />
              Review Answers
            </button>
            <button
              onClick={onExit}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-violet-500/25"
            >
              Back to Quizzes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review state
  if (quizState === 'reviewing') {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-8 h-8 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold text-white">{quiz.title}</h1>
                  <p className="text-sm text-gray-400">Review your answers</p>
                </div>
              </div>
              <button
                onClick={onExit}
                className="px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-all"
              >
                Done
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((question, idx) => {
              const userAnswer = answers[question.id];
              const isCorrect = userAnswer && (question.question_type === 'short_answer'
                ? userAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim()
                : userAnswer === question.correct_answer);

              return (
                <div 
                  key={question.id}
                  className={`bg-white/5 rounded-xl border p-5 ${
                    isCorrect ? 'border-emerald-500/30' : 'border-red-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCorrect ? 'bg-emerald-500/20' : 'bg-red-500/20'
                    }`}>
                      {isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Question {idx + 1}</p>
                      <p className="text-white font-medium">{question.question_text}</p>
                    </div>
                  </div>

                  <div className="pl-11 space-y-2">
                    {userAnswer && (
                      <div className={`flex items-center gap-2 text-sm ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className="font-medium">Your answer:</span>
                        <span>{userAnswer}</span>
                      </div>
                    )}
                    {!isCorrect && (
                      <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <span className="font-medium">Correct answer:</span>
                        <span>{question.correct_answer}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Trophy className="w-4 h-4" />
                      <span>{isCorrect ? question.points : 0} / {question.points} points</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Playing state
  const currentQ = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-amber-400" />
              <span className="font-bold text-white">{quiz.title}</span>
            </div>
            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                timeRemaining < 60 
                  ? 'bg-red-500/20 text-red-400 animate-pulse' 
                  : timeRemaining < 300 
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-white/10 text-white'
              }`}>
                <Clock className="w-5 h-5" />
                <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
          
          {/* Progress bar */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-400 shrink-0">
              {currentQuestion + 1} / {questions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 bg-violet-500/20 text-violet-400 rounded-full text-sm font-medium">
                {currentQ.question_type.replace('_', ' ')}
              </span>
              <span className="flex items-center gap-1 text-amber-400 text-sm font-medium">
                <Trophy className="w-4 h-4" />
                {currentQ.points} pts
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-8">{currentQ.question_text}</h2>

            {/* Answer options */}
            {currentQ.question_type === 'multiple_choice' && (
              <div className="space-y-3">
                {currentQ.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAnswer(currentQ.id, option)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      answers[currentQ.id] === option
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-white/10 text-gray-300 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                        answers[currentQ.id] === option
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-gray-600 text-gray-400'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="font-medium">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {currentQ.question_type === 'true_false' && (
              <div className="grid grid-cols-2 gap-4">
                {['True', 'False'].map((option) => (
                  <button
                    key={option}
                    onClick={() => selectAnswer(currentQ.id, option)}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      answers[currentQ.id] === option
                        ? option === 'True'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-white/10 text-gray-300 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {option === 'True' ? (
                        <CheckCircle2 className="w-8 h-8" />
                      ) : (
                        <XCircle className="w-8 h-8" />
                      )}
                      <span className="font-bold text-lg">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {currentQ.question_type === 'short_answer' && (
              <div>
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => selectAnswer(currentQ.id, e.target.value)}
                  className="w-full px-6 py-4 bg-white/5 border-2 border-white/10 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-all"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={prevQuestion}
              disabled={currentQuestion === 0}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestion(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    idx === currentQuestion
                      ? 'bg-amber-500 scale-125'
                      : answers[questions[idx].id]
                        ? 'bg-emerald-500'
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {currentQuestion === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-emerald-500/25"
              >
                <Flag className="w-5 h-5" />
                Submit Quiz
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-amber-500/25"
              >
                Next
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Answered indicator */}
          <div className="text-center mt-6">
            <span className="text-gray-400 text-sm">
              {answeredCount} of {questions.length} questions answered
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
