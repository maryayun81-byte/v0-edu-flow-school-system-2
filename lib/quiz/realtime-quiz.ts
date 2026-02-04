// Real-time Quiz Functionality
// Handles real-time updates for quiz submissions and grading

import { createClient } from '@supabase/supabase-js'
import { RealtimeChannel } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Subscribe to quiz submissions in real-time
 * For teachers to see when students submit quizzes
 */
export function subscribeToQuizSubmissions(
  quizId: string,
  onSubmission: (attempt: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`quiz:${quizId}:submissions`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'quiz_attempts',
        filter: `quiz_id=eq.${quizId}`
      },
      (payload) => {
        onSubmission(payload.new)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'quiz_attempts',
        filter: `quiz_id=eq.${quizId}`
      },
      (payload) => {
        // Only notify on status changes to 'submitted'
        if (payload.new.status === 'submitted' && payload.old.status !== 'submitted') {
          onSubmission(payload.new)
        }
      }
    )
    .subscribe()

  return channel
}

/**
 * Subscribe to grading updates in real-time
 * For students to see when their quiz is graded
 */
export function subscribeToGradingUpdates(
  attemptId: string,
  onGraded: (attempt: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`attempt:${attemptId}:grading`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'quiz_attempts',
        filter: `id=eq.${attemptId}`
      },
      (payload) => {
        // Notify when status changes to 'graded'
        if (payload.new.status === 'graded' && payload.old.status !== 'graded') {
          onGraded(payload.new)
        }
      }
    )
    .subscribe()

  return channel
}

/**
 * Subscribe to new quiz publications
 * For students to see when teachers publish new quizzes
 */
export function subscribeToNewQuizzes(
  classId: string,
  onNewQuiz: (quiz: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`class:${classId}:quizzes`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'quizzes',
        filter: `class_id=eq.${classId}`
      },
      (payload) => {
        if (payload.new.status === 'published') {
          onNewQuiz(payload.new)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'quizzes',
        filter: `class_id=eq.${classId}`
      },
      (payload) => {
        // Notify when quiz is published
        if (payload.new.status === 'published' && payload.old.status !== 'published') {
          onNewQuiz(payload.new)
        }
      }
    )
    .subscribe()

  return channel
}

/**
 * Send notification when quiz is published
 */
export async function notifyQuizPublished(
  quizId: string,
  teacherId: string
): Promise<void> {
  // Fetch quiz details
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('title, class_id')
    .eq('id', quizId)
    .single()

  if (!quiz) return

  // Fetch all students in the class
  const { data: students } = await supabase
    .from('auth.users')
    .select('id')
    .eq('raw_user_meta_data->>class_id', quiz.class_id)
    .eq('raw_user_meta_data->>role', 'student')

  if (!students || students.length === 0) return

  // Create notifications for all students
  const notifications = students.map(student => ({
    recipient_id: student.id,
    sender_id: teacherId,
    type: 'quiz_published',
    title: 'New Quiz Available',
    message: `A new quiz "${quiz.title}" has been published`,
    priority: 'high',
    action_url: `/student/quizzes/${quizId}`,
    broadcast: false
  }))

  await supabase.from('notifications').insert(notifications)
}

/**
 * Send notification when quiz is graded
 */
export async function notifyQuizGraded(
  attemptId: string,
  teacherId: string
): Promise<void> {
  // Fetch attempt details
  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select(`
      student_id,
      total_marks_obtained,
      quiz:quizzes(title, total_marks)
    `)
    .eq('id', attemptId)
    .single()

  if (!attempt) return

  // Create notification for student
  await supabase.from('notifications').insert({
    recipient_id: attempt.student_id,
    sender_id: teacherId,
    type: 'quiz_graded',
    title: 'Quiz Graded',
    message: `Your quiz "${attempt.quiz.title}" has been graded. Score: ${attempt.total_marks_obtained}/${attempt.quiz.total_marks}`,
    priority: 'medium',
    action_url: `/student/quizzes/${attemptId}/results`,
    broadcast: false
  })
}

/**
 * Send notification when student submits quiz
 */
export async function notifyQuizSubmitted(
  attemptId: string,
  studentId: string
): Promise<void> {
  // Fetch attempt details
  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select(`
      quiz:quizzes(title, created_by)
    `)
    .eq('id', attemptId)
    .single()

  if (!attempt) return

  // Fetch student name
  const { data: student } = await supabase
    .from('auth.users')
    .select('raw_user_meta_data')
    .eq('id', studentId)
    .single()

  const studentName = student?.raw_user_meta_data?.full_name || 'A student'

  // Create notification for teacher
  await supabase.from('notifications').insert({
    recipient_id: attempt.quiz.created_by,
    sender_id: studentId,
    type: 'quiz_submitted',
    title: 'Quiz Submitted',
    message: `${studentName} has submitted the quiz "${attempt.quiz.title}"`,
    priority: 'medium',
    action_url: `/teacher/quizzes/${attempt.quiz.id}/grade`,
    broadcast: false
  })
}

/**
 * Auto-save quiz answer
 */
export async function autoSaveAnswer(
  attemptId: string,
  questionId: string,
  answer: {
    selected_options?: string[]
    text_answer?: string
    file_url?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if answer already exists
    const { data: existing } = await supabase
      .from('quiz_answers')
      .select('id')
      .eq('attempt_id', attemptId)
      .eq('question_id', questionId)
      .single()

    if (existing) {
      // Update existing answer
      const { error } = await supabase
        .from('quiz_answers')
        .update({
          ...answer,
          saved_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (error) {
        return { success: false, error: error.message }
      }
    } else {
      // Insert new answer
      const { error } = await supabase
        .from('quiz_answers')
        .insert({
          attempt_id: attemptId,
          question_id: questionId,
          ...answer,
          saved_at: new Date().toISOString()
        })

      if (error) {
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save answer'
    }
  }
}
