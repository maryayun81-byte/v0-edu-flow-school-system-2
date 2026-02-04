// Quiz Utility Functions
// Helper functions for quiz management and operations

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface Quiz {
  id: string
  title: string
  description?: string
  instructions?: string
  subject_id?: string
  class_id?: string
  total_marks: number
  passing_marks: number
  duration_minutes?: number
  max_attempts: number
  scheduled_start?: string
  scheduled_end?: string
  show_results_immediately: boolean
  status: 'draft' | 'published' | 'closed'
  created_by: string
  created_at: string
  updated_at: string
}

/**
 * Check if a quiz is currently active
 */
export function isQuizActive(quiz: Quiz): boolean {
  const now = new Date()
  
  // Check if quiz is published
  if (quiz.status !== 'published') {
    return false
  }

  // Check start time
  if (quiz.scheduled_start) {
    const startTime = new Date(quiz.scheduled_start)
    if (now < startTime) {
      return false
    }
  }

  // Check end time
  if (quiz.scheduled_end) {
    const endTime = new Date(quiz.scheduled_end)
    if (now > endTime) {
      return false
    }
  }

  return true
}

/**
 * Check if a student can attempt a quiz
 */
export async function canAttemptQuiz(
  quizId: string,
  studentId: string
): Promise<{ canAttempt: boolean; reason?: string; attemptsLeft?: number }> {
  // Fetch quiz details
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single()

  if (!quiz) {
    return { canAttempt: false, reason: 'Quiz not found' }
  }

  // Check if quiz is active
  if (!isQuizActive(quiz)) {
    return { canAttempt: false, reason: 'Quiz is not currently active' }
  }

  // Check previous attempts
  const { data: attempts, count } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact' })
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)

  const attemptCount = count || 0

  if (attemptCount >= quiz.max_attempts) {
    return {
      canAttempt: false,
      reason: `Maximum attempts (${quiz.max_attempts}) reached`,
      attemptsLeft: 0
    }
  }

  return {
    canAttempt: true,
    attemptsLeft: quiz.max_attempts - attemptCount
  }
}

/**
 * Calculate time remaining for a quiz attempt
 */
export function calculateTimeRemaining(
  startedAt: string,
  durationMinutes?: number
): number | null {
  if (!durationMinutes) {
    return null // Untimed quiz
  }

  const startTime = new Date(startedAt)
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)
  const now = new Date()

  const remainingMs = endTime.getTime() - now.getTime()
  return Math.max(0, Math.floor(remainingMs / 1000)) // Return seconds
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate quiz statistics
 */
export async function getQuizStatistics(quizId: string): Promise<{
  totalAttempts: number
  completedAttempts: number
  averageScore: number
  highestScore: number
  lowestScore: number
  passRate: number
}> {
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('total_marks_obtained, status')
    .eq('quiz_id', quizId)
    .eq('status', 'graded')

  if (!attempts || attempts.length === 0) {
    return {
      totalAttempts: 0,
      completedAttempts: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passRate: 0
    }
  }

  const scores = attempts
    .map(a => a.total_marks_obtained || 0)
    .filter(score => score !== null)

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('passing_marks')
    .eq('id', quizId)
    .single()

  const passingMarks = quiz?.passing_marks || 0
  const passedCount = scores.filter(score => score >= passingMarks).length

  return {
    totalAttempts: attempts.length,
    completedAttempts: scores.length,
    averageScore: scores.length > 0 
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : 0,
    highestScore: scores.length > 0 ? Math.max(...scores) : 0,
    lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
    passRate: scores.length > 0 
      ? Math.round((passedCount / scores.length) * 100)
      : 0
  }
}

/**
 * Get student's quiz history
 */
export async function getStudentQuizHistory(
  studentId: string,
  quizId?: string
) {
  let query = supabase
    .from('quiz_attempts')
    .select(`
      *,
      quiz:quizzes(title, total_marks)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (quizId) {
    query = query.eq('quiz_id', quizId)
  }

  const { data, error } = await query

  return { data, error }
}

/**
 * Shuffle array (for shuffling questions)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Calculate percentage score
 */
export function calculatePercentage(obtained: number, total: number): number {
  if (total === 0) return 0
  return Math.round((obtained / total) * 100)
}

/**
 * Get grade letter based on percentage
 */
export function getGradeLetter(percentage: number): string {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B+'
  if (percentage >= 60) return 'B'
  if (percentage >= 50) return 'C'
  if (percentage >= 40) return 'D'
  return 'F'
}

/**
 * Validate quiz before publishing
 */
export function validateQuiz(quiz: Quiz, questions: any[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!quiz.title || quiz.title.trim() === '') {
    errors.push('Quiz title is required')
  }

  if (questions.length === 0) {
    errors.push('Quiz must have at least one question')
  }

  if (quiz.passing_marks > quiz.total_marks) {
    errors.push('Passing marks cannot exceed total marks')
  }

  if (quiz.scheduled_start && quiz.scheduled_end) {
    const start = new Date(quiz.scheduled_start)
    const end = new Date(quiz.scheduled_end)
    if (end <= start) {
      errors.push('End time must be after start time')
    }
  }

  // Validate each question
  questions.forEach((q, index) => {
    if (!q.question_text || q.question_text.trim() === '') {
      errors.push(`Question ${index + 1}: Question text is required`)
    }

    if (q.marks <= 0) {
      errors.push(`Question ${index + 1}: Marks must be greater than 0`)
    }

    if (['mcq_single', 'mcq_multiple', 'multiple_choice'].includes(q.question_type)) {
      if (!q.options || q.options.length < 2) {
        errors.push(`Question ${index + 1}: Multiple choice questions must have at least 2 options`)
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}
