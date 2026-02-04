'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus,
  X,
  Trash2,
  Loader,
  Brain,
  Clock,
  Trophy,
  GripVertical,
  CheckCircle2,
  Circle,
  Type,
  ListChecks,
  Calendar,
  Eye,
  Edit3,
  Copy,
  BarChart3,
  Users,
  Sparkles,
  Target,
  Zap
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QuizQuestion {
  id?: string;
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
  questions?: QuizQuestion[];
  attempt_count?: number;
  avg_score?: number;
}

interface QuizBuilderProps {
  userId: string;
  onClose: () => void;
}

export default function QuizBuilder({ userId, onClose }: QuizBuilderProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  // Quiz form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState<number | ''>('');
  const [pointsPerQuestion, setPointsPerQuestion] = useState(10);
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchQuizzes();
  }, [userId]);

  async function fetchQuizzes() {
    try {
      const { data: quizzesData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (quizzesData) {
        // Fetch attempt stats for each quiz
        const quizzesWithStats = await Promise.all(
          quizzesData.map(async (quiz) => {
            const { data: attempts } = await supabase
              .from('quiz_attempts')
              .select('score')
              .eq('quiz_id', quiz.id)
              .eq('completed', true);

            return {
              ...quiz,
              attempt_count: attempts?.length || 0,
              avg_score: attempts?.length 
                ? Math.round(attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length) 
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

  async function loadQuizForEdit(quiz: Quiz) {
    setSelectedQuiz(quiz);
    setTitle(quiz.title);
    setDescription(quiz.description || '');
    setTimeLimit(quiz.duration_minutes || '');
    setPointsPerQuestion(quiz.points_per_question);
    setScheduledStart(quiz.scheduled_start ? quiz.scheduled_start.slice(0, 16) : '');
    setScheduledEnd(quiz.scheduled_end ? quiz.scheduled_end.slice(0, 16) : '');

    const { data: questionsData } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true });

    if (questionsData) {
      setQuestions(questionsData.map(q => ({
        ...q,
        options: q.options || []
      })));
    }
    setView('edit');
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setTimeLimit('');
    setPointsPerQuestion(10);
    setScheduledStart('');
    setScheduledEnd('');
    setQuestions([]);
    setSelectedQuiz(null);
    setError('');
    setSuccess('');
  }

  function addQuestion(type: 'multiple_choice' | 'true_false' | 'short_answer') {
    const newQuestion: QuizQuestion = {
      question_text: '',
      question_type: type,
      options: type === 'multiple_choice' ? ['', '', '', ''] : type === 'true_false' ? ['True', 'False'] : [],
      correct_answer: type === 'true_false' ? 'True' : '',
      marks: pointsPerQuestion,
      order_index: questions.length
    };
    setQuestions([...questions, newQuestion]);
  }

  function updateQuestion(index: number, updates: Partial<QuizQuestion>) {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex] = value;
    setQuestions(updated);
  }

  async function handleSave(publish: boolean = false) {
    if (!title.trim()) {
      setError('Please enter a quiz title');
      return;
    }
    if (questions.length === 0) {
      setError('Please add at least one question');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question ${i + 1} is empty`);
        return;
      }
      if (q.question_type === 'multiple_choice') {
        const validOptions = q.options.filter(o => o.trim());
        if (validOptions.length < 2) {
          setError(`Question ${i + 1} needs at least 2 options`);
          return;
        }
        if (!q.correct_answer || !validOptions.includes(q.correct_answer)) {
          setError(`Please select a correct answer for question ${i + 1}`);
          return;
        }
      }
      if (q.question_type === 'short_answer' && !q.correct_answer.trim()) {
        setError(`Please provide the correct answer for question ${i + 1}`);
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const quizData = {
        title,
        description,
        duration_minutes: timeLimit || null,
        points_per_question: pointsPerQuestion,
        is_published: publish,
        scheduled_start: scheduledStart || null,
        scheduled_end: scheduledEnd || null,
        created_by: userId
      };

      let quizId = selectedQuiz?.id;

      if (selectedQuiz) {
        // Update existing quiz
        const { error: updateError } = await supabase
          .from('quizzes')
          .update(quizData)
          .eq('id', selectedQuiz.id);

        if (updateError) throw updateError;

        // Delete existing questions
        await supabase.from('quiz_questions').delete().eq('quiz_id', selectedQuiz.id);
      } else {
        // Create new quiz
        const { data: newQuiz, error: createError } = await supabase
          .from('quizzes')
          .insert([quizData])
          .select()
          .single();

        if (createError) throw createError;
        quizId = newQuiz.id;
      }

      // Insert questions
      const questionsToInsert = questions.map((q, idx) => ({
        quiz_id: quizId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options.filter(o => o.trim()),
        correct_answer: q.correct_answer,
        marks: q.marks,
        order_index: idx
      }));

      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      setSuccess(publish ? 'Quiz published successfully!' : 'Quiz saved as draft!');
      setTimeout(() => {
        resetForm();
        setView('list');
        fetchQuizzes();
      }, 1500);
    } catch (err: unknown) {
      console.error('Error saving quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(quiz: Quiz) {
    try {
      await supabase
        .from('quizzes')
        .update({ is_published: !quiz.is_published })
        .eq('id', quiz.id);
      fetchQuizzes();
    } catch (err) {
      console.error('Error toggling publish:', err);
    }
  }

  async function deleteQuiz(quiz: Quiz) {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) return;

    try {
      await supabase.from('quiz_questions').delete().eq('quiz_id', quiz.id);
      await supabase.from('quiz_attempts').delete().eq('quiz_id', quiz.id);
      await supabase.from('quizzes').delete().eq('id', quiz.id);
      fetchQuizzes();
    } catch (err) {
      console.error('Error deleting quiz:', err);
    }
  }

  async function duplicateQuiz(quiz: Quiz) {
    try {
      // Load questions
      const { data: questionsData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quiz.id);

      // Create new quiz
      const { data: newQuiz, error: createError } = await supabase
        .from('quizzes')
        .insert([{
          title: `${quiz.title} (Copy)`,
          description: quiz.description,
          duration_minutes: quiz.duration_minutes,
          points_per_question: quiz.points_per_question,
          is_published: false,
          created_by: userId
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Copy questions
      if (questionsData && questionsData.length > 0) {
        await supabase.from('quiz_questions').insert(
          questionsData.map(q => ({
            quiz_id: newQuiz.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            correct_answer: q.correct_answer,
            marks: q.marks,
            order_index: q.order_index
          }))
        );
      }

      fetchQuizzes();
    } catch (err) {
      console.error('Error duplicating quiz:', err);
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 mb-8 border border-white/10">
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 mb-8 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Quiz Builder</h2>
            <p className="text-sm text-gray-400">
              {view === 'list' ? 'Create engaging quizzes for your students' : view === 'create' ? 'New Quiz' : 'Edit Quiz'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (view !== 'list') {
              resetForm();
              setView('list');
            } else {
              onClose();
            }
          }}
          className="text-gray-400 hover:text-white p-2 transition-colors rounded-lg hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
          <p className="text-emerald-400 text-sm font-medium">{success}</p>
        </div>
      )}

      {view === 'list' ? (
        <div className="space-y-4">
          <button
            onClick={() => setView('create')}
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
                <div
                  key={quiz.id}
                  className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white truncate">{quiz.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          quiz.is_published 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {quiz.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      {quiz.description && (
                        <p className="text-gray-400 text-sm mb-3 line-clamp-1">{quiz.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {quiz.duration_minutes && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Clock className="w-4 h-4" />
                            {quiz.duration_minutes} min
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-gray-400">
                          <Trophy className="w-4 h-4" />
                          {quiz.points_per_question} pts/question
                        </span>
                        <span className="flex items-center gap-1 text-gray-400">
                          <Users className="w-4 h-4" />
                          {quiz.attempt_count} attempts
                        </span>
                        {quiz.attempt_count && quiz.attempt_count > 0 && (
                          <span className="flex items-center gap-1 text-violet-400">
                            <BarChart3 className="w-4 h-4" />
                            Avg: {quiz.avg_score}%
                          </span>
                        )}
                      </div>
                      {quiz.scheduled_start && (
                        <div className="mt-2 flex items-center gap-1 text-amber-400 text-sm">
                          <Calendar className="w-4 h-4" />
                          Scheduled: {new Date(quiz.scheduled_start).toLocaleString()}
                          {quiz.scheduled_end && ` - ${new Date(quiz.scheduled_end).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadQuizForEdit(quiz)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => duplicateQuiz(quiz)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Duplicate"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => togglePublish(quiz)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          quiz.is_published
                            ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        }`}
                      >
                        {quiz.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => deleteQuiz(quiz)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete"
                      >
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
        <div className="space-y-6">
          {/* Quiz Details */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Quiz Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">Title</label>
                <input
                  type="text"
                  placeholder="e.g., Chapter 5 Review Quiz"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">Description (optional)</label>
                <textarea
                  placeholder="Brief description of the quiz..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Time Limit (minutes)</label>
                <input
                  type="number"
                  placeholder="No limit"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : '')}
                  min="1"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Points per Question</label>
                <input
                  type="number"
                  value={pointsPerQuestion}
                  onChange={(e) => setPointsPerQuestion(parseInt(e.target.value) || 10)}
                  min="1"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Available From (optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Available Until (optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Add Question Buttons */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Add Questions
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => addQuestion('multiple_choice')}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg font-medium hover:bg-violet-500/30 transition-all"
              >
                <ListChecks className="w-4 h-4" />
                Multiple Choice
              </button>
              <button
                onClick={() => addQuestion('true_false')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg font-medium hover:bg-emerald-500/30 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                True / False
              </button>
              <button
                onClick={() => addQuestion('short_answer')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg font-medium hover:bg-blue-500/30 transition-all"
              >
                <Type className="w-4 h-4" />
                Short Answer
              </button>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="text-center py-8 bg-white/5 rounded-xl border border-dashed border-white/20">
                <Zap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Add questions using the buttons above</p>
              </div>
            ) : (
              questions.map((question, qIndex) => (
                <QuestionEditor
                  key={qIndex}
                  question={question}
                  index={qIndex}
                  onUpdate={(updates) => updateQuestion(qIndex, updates)}
                  onUpdateOption={(optIdx, value) => updateOption(qIndex, optIdx, value)}
                  onRemove={() => removeQuestion(qIndex)}
                />
              ))
            )}
          </div>

          {/* Save Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/10">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all disabled:opacity-50"
            >
              {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
              Save as Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/25"
            >
              {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {selectedQuiz ? 'Update & Publish' : 'Save & Publish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  onUpdate,
  onUpdateOption,
  onRemove
}: {
  question: QuizQuestion;
  index: number;
  onUpdate: (updates: Partial<QuizQuestion>) => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onRemove: () => void;
}) {
  const typeColors = {
    multiple_choice: 'violet',
    true_false: 'emerald',
    short_answer: 'blue'
  };

  const typeIcons = {
    multiple_choice: ListChecks,
    true_false: CheckCircle2,
    short_answer: Type
  };

  const TypeIcon = typeIcons[question.question_type];
  const color = typeColors[question.question_type];

  return (
    <div className={`bg-white/5 rounded-xl border border-white/10 overflow-hidden`}>
      <div className={`px-5 py-3 bg-${color}-500/10 border-b border-white/10 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <GripVertical className="w-5 h-5 text-gray-500 cursor-grab" />
          <div className={`w-8 h-8 bg-${color}-500/20 rounded-lg flex items-center justify-center`}>
            <TypeIcon className={`w-4 h-4 text-${color}-400`} />
          </div>
          <span className="font-semibold text-white">Question {index + 1}</span>
          <span className={`text-xs px-2 py-1 rounded-full bg-${color}-500/20 text-${color}-400 font-medium`}>
            {question.question_type.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <input
              type="number"
              value={question.marks}
              onChange={(e) => onUpdate({ marks: parseInt(e.target.value) || 10 })}
              min="1"
              className="w-16 px-2 py-1 bg-white/10 border border-white/10 rounded-lg text-white text-sm text-center"
            />
            <span className="text-gray-400 text-sm">pts</span>
          </div>
          <button
            onClick={onRemove}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Question</label>
          <textarea
            placeholder="Enter your question here..."
            value={question.question_text}
            onChange={(e) => onUpdate({ question_text: e.target.value })}
            rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
          />
        </div>

        {question.question_type === 'multiple_choice' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400">Options (click to set correct answer)</label>
            {question.options.map((option, optIndex) => (
              <div key={optIndex} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onUpdate({ correct_answer: option })}
                  className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    question.correct_answer === option && option.trim()
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {question.correct_answer === option && option.trim() && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </button>
                <input
                  type="text"
                  placeholder={`Option ${optIndex + 1}`}
                  value={option}
                  onChange={(e) => onUpdateOption(optIndex, e.target.value)}
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-all"
                />
              </div>
            ))}
            {question.options.length < 6 && (
              <button
                type="button"
                onClick={() => onUpdate({ options: [...question.options, ''] })}
                className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            )}
          </div>
        )}

        {question.question_type === 'true_false' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400">Correct Answer</label>
            <div className="flex gap-4">
              {['True', 'False'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onUpdate({ correct_answer: option })}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    question.correct_answer === option
                      ? option === 'True'
                        ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500'
                        : 'bg-red-500/20 text-red-400 border-2 border-red-500'
                      : 'bg-white/5 text-gray-400 border-2 border-transparent hover:border-white/20'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {question.question_type === 'short_answer' && (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Correct Answer</label>
            <input
              type="text"
              placeholder="Enter the correct answer"
              value={question.correct_answer}
              onChange={(e) => onUpdate({ correct_answer: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <p className="text-xs text-gray-500 mt-2">Student answers will be compared case-insensitively</p>
          </div>
        )}
      </div>
    </div>
  );
}
