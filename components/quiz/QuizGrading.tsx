"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  FileText,
  Save,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface QuizGradingProps {
  quizId: string
  teacherId: string
  onClose: () => void
}

export default function QuizGrading({ quizId, teacherId, onClose }: QuizGradingProps) {
  const [attempts, setAttempts] = useState<any[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null)
  const [currentAnswerIndex, setCurrentAnswerIndex] = useState(0)
  const [marks, setMarks] = useState<number>(0)
  const [feedback, setFeedback] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'needs_grading'>('needs_grading')

  useEffect(() => {
    fetchAttempts()
  }, [quizId, filter])

  useEffect(() => {
    if (selectedAttempt && selectedAttempt.answers[currentAnswerIndex]) {
      const currentAnswer = selectedAttempt.answers[currentAnswerIndex]
      setMarks(currentAnswer.marks_obtained || 0)
      setFeedback(currentAnswer.teacher_feedback || '')
    }
  }, [selectedAttempt, currentAnswerIndex])

  async function fetchAttempts() {
    setLoading(true)
    
    let query = supabase
      .from('quiz_attempts')
      .select(`
        *,
        student:auth.users!quiz_attempts_student_id_fkey(
          id,
          raw_user_meta_data
        ),
        answers:quiz_answers(
          *,
          question:quiz_questions(*)
        )
      `)
      .eq('quiz_id', quizId)
      .in('status', ['submitted', 'graded'])
      .order('submitted_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching attempts:', error)
      setLoading(false)
      return
    }

    // Filter based on needs_grading if selected
    let filteredData = data || []
    if (filter === 'needs_grading') {
      filteredData = filteredData.filter(attempt => 
        attempt.answers.some((a: any) => a.needs_manual_grading)
      )
    }

    setAttempts(filteredData)
    setLoading(false)
  }

  async function saveGrade() {
    if (!selectedAttempt) return

    setSaving(true)
    const currentAnswer = selectedAttempt.answers[currentAnswerIndex]

    // Update the answer
    const { error: answerError } = await supabase
      .from('quiz_answers')
      .update({
        marks_obtained: marks,
        teacher_feedback: feedback,
        needs_manual_grading: false
      })
      .eq('id', currentAnswer.id)

    if (answerError) {
      console.error('Error updating answer:', answerError)
      setSaving(false)
      return
    }

    // Recalculate total marks for the attempt
    await recalculateAttemptMarks(selectedAttempt.id)

    // Refresh data
    await fetchAttempts()
    
    // Move to next question that needs grading
    const nextIndex = selectedAttempt.answers.findIndex(
      (a: any, idx: number) => idx > currentAnswerIndex && a.needs_manual_grading
    )
    
    if (nextIndex !== -1) {
      setCurrentAnswerIndex(nextIndex)
    }

    setSaving(false)
  }

  async function recalculateAttemptMarks(attemptId: string) {
    // Fetch all answers for this attempt
    const { data: answers } = await supabase
      .from('quiz_answers')
      .select('marks_obtained, needs_manual_grading')
      .eq('attempt_id', attemptId)

    if (!answers) return

    const totalMarks = answers.reduce((sum, a) => sum + (a.marks_obtained || 0), 0)
    const autoGradedMarks = answers
      .filter(a => !a.needs_manual_grading)
      .reduce((sum, a) => sum + (a.marks_obtained || 0), 0)
    const manualGradedMarks = answers
      .filter(a => a.needs_manual_grading)
      .reduce((sum, a) => sum + (a.marks_obtained || 0), 0)

    const allGraded = answers.every(a => !a.needs_manual_grading)

    // Update attempt
    await supabase
      .from('quiz_attempts')
      .update({
        total_marks_obtained: totalMarks,
        auto_graded_marks: autoGradedMarks,
        manual_graded_marks: manualGradedMarks,
        status: allGraded ? 'graded' : 'submitted',
        graded_at: allGraded ? new Date().toISOString() : null,
        graded_by: allGraded ? teacherId : null
      })
      .eq('id', attemptId)
  }

  const currentAnswer = selectedAttempt?.answers[currentAnswerIndex]
  const currentQuestion = currentAnswer?.question

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Clock className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Left Sidebar - Student List */}
      <div className="lg:w-80 flex-shrink-0">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Submissions</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={filter === 'needs_grading' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('needs_grading')}
              className="flex-1"
            >
              <Filter className="w-3 h-3 mr-1" />
              Needs Grading
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="flex-1"
            >
              All
            </Button>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No submissions found
                </p>
              ) : (
                attempts.map((attempt) => {
                  const needsGrading = attempt.answers.filter((a: any) => a.needs_manual_grading).length
                  const studentName = attempt.student?.raw_user_meta_data?.full_name || 'Unknown Student'
                  
                  return (
                    <Card
                      key={attempt.id}
                      className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                        selectedAttempt?.id === attempt.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => {
                        setSelectedAttempt(attempt)
                        setCurrentAnswerIndex(0)
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{studentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(attempt.submitted_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {needsGrading > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {needsGrading}
                          </Badge>
                        )}
                      </div>
                      {attempt.status === 'graded' && (
                        <div className="mt-2 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-green-600">
                            {attempt.total_marks_obtained} marks
                          </span>
                        </div>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Main Grading Area */}
      {selectedAttempt ? (
        <div className="flex-1">
          <Card className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {selectedAttempt.student?.raw_user_meta_data?.full_name || 'Unknown Student'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Submitted {new Date(selectedAttempt.submitted_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Score</p>
                <p className="text-2xl font-bold text-primary">
                  {selectedAttempt.total_marks_obtained || 0} marks
                </p>
              </div>
            </div>

            {/* Question Navigator */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {selectedAttempt.answers.map((answer: any, idx: number) => (
                <Button
                  key={answer.id}
                  variant={currentAnswerIndex === idx ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentAnswerIndex(idx)}
                  className="relative"
                >
                  Q{idx + 1}
                  {answer.needs_manual_grading && (
                    <AlertCircle className="w-3 h-3 absolute -top-1 -right-1 text-orange-500" />
                  )}
                </Button>
              ))}
            </div>

            {/* Current Question */}
            {currentQuestion && (
              <div className="space-y-6">
                {/* Question */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Question {currentAnswerIndex + 1}</h3>
                    <Badge variant="outline">{currentQuestion.marks} marks</Badge>
                  </div>
                  <Card className="p-4 bg-muted/50">
                    <p className="text-sm">{currentQuestion.question_text}</p>
                    {currentQuestion.question_image_url && (
                      <img 
                        src={currentQuestion.question_image_url} 
                        alt="Question" 
                        className="mt-4 max-w-md rounded-lg"
                      />
                    )}
                  </Card>
                </div>

                {/* Student Answer */}
                <div>
                  <h3 className="font-semibold mb-2">Student Answer</h3>
                  <Card className="p-4">
                    {currentAnswer.text_answer && (
                      <p className="text-sm whitespace-pre-wrap">{currentAnswer.text_answer}</p>
                    )}
                    {currentAnswer.selected_options && (
                      <div className="space-y-2">
                        {JSON.parse(currentAnswer.selected_options).map((optionId: string) => (
                          <div key={optionId} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-sm">Option {optionId}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {currentAnswer.file_url && (
                      <img 
                        src={currentAnswer.file_url} 
                        alt="Student submission" 
                        className="max-w-md rounded-lg"
                      />
                    )}
                    {currentAnswer.auto_graded && (
                      <Badge variant="secondary" className="mt-2">
                        Auto-graded: {currentAnswer.marks_obtained} marks
                      </Badge>
                    )}
                  </Card>
                </div>

                {/* Sample Answer (if available) */}
                {currentQuestion.sample_answer && (
                  <div>
                    <h3 className="font-semibold mb-2">Sample Answer</h3>
                    <Card className="p-4 bg-green-50 dark:bg-green-950/20">
                      <p className="text-sm">{currentQuestion.sample_answer}</p>
                    </Card>
                  </div>
                )}

                {/* Grading Section */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Grade This Answer</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Marks Obtained (out of {currentQuestion.marks})
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max={currentQuestion.marks}
                        step="0.5"
                        value={marks}
                        onChange={(e) => setMarks(parseFloat(e.target.value))}
                        className="max-w-xs"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Feedback (optional)
                      </label>
                      <Textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Add feedback for the student..."
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={saveGrade}
                        disabled={saving}
                        className="flex-1"
                      >
                        {saving ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Grade
                          </>
                        )}
                      </Button>

                      {currentAnswerIndex < selectedAttempt.answers.length - 1 && (
                        <Button
                          variant="outline"
                          onClick={() => setCurrentAnswerIndex(currentAnswerIndex + 1)}
                        >
                          Next <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Select a submission to start grading</p>
          </div>
        </div>
      )}
    </div>
  )
}
