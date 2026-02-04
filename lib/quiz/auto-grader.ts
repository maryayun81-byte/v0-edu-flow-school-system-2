// Auto-Grading Logic for Quiz System
// Handles automatic marking of quiz answers based on question type

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface QuizQuestion {
  id: string
  question_type: 'mcq_single' | 'mcq_multiple' | 'true_false' | 'short_text' | 'long_text' | 'equation' | 'image_based' | 'multiple_choice' | 'short_answer'
  correct_answer: string
  marks: number
  keywords?: string[]
  sample_answer?: string
}

export interface QuizAnswer {
  id?: string
  question_id: string
  selected_options?: string[] // For MCQ
  text_answer?: string // For text-based questions
  file_url?: string // For file uploads
}

export interface AutoGradeResult {
  isCorrect: boolean
  marksObtained: number
  needsManualGrading: boolean
  feedback?: string
}

/**
 * Auto-grade a single answer based on question type
 */
export async function autoGradeAnswer(
  question: QuizQuestion,
  answer: QuizAnswer
): Promise<AutoGradeResult> {
  const questionType = question.question_type

  // Handle legacy question types
  if (questionType === 'multiple_choice') {
    return gradeMCQSingle(question, answer)
  }
  if (questionType === 'short_answer') {
    return gradeShortText(question, answer)
  }

  // Handle new question types
  switch (questionType) {
    case 'mcq_single':
      return gradeMCQSingle(question, answer)
    
    case 'mcq_multiple':
      return gradeMCQMultiple(question, answer)
    
    case 'true_false':
      return gradeTrueFalse(question, answer)
    
    case 'short_text':
      return gradeShortText(question, answer)
    
    case 'long_text':
    case 'equation':
    case 'image_based':
      return flagForManualGrading(question)
    
    default:
      return flagForManualGrading(question)
  }
}

/**
 * Grade single-choice MCQ
 */
function gradeMCQSingle(question: QuizQuestion, answer: QuizAnswer): AutoGradeResult {
  const selectedOption = answer.selected_options?.[0]
  const isCorrect = selectedOption === question.correct_answer
  
  return {
    isCorrect,
    marksObtained: isCorrect ? question.marks : 0,
    needsManualGrading: false,
    feedback: isCorrect ? 'Correct!' : 'Incorrect'
  }
}

/**
 * Grade multiple-choice MCQ with partial credit
 */
async function gradeMCQMultiple(question: QuizQuestion, answer: QuizAnswer): Promise<AutoGradeResult> {
  if (!answer.selected_options || answer.selected_options.length === 0) {
    return {
      isCorrect: false,
      marksObtained: 0,
      needsManualGrading: false,
      feedback: 'No answer selected'
    }
  }

  // Fetch correct options from database
  const { data: options } = await supabase
    .from('quiz_question_options')
    .select('id, is_correct')
    .eq('question_id', question.id)

  if (!options) {
    return flagForManualGrading(question)
  }

  const correctOptionIds = options.filter(o => o.is_correct).map(o => o.id)
  const selectedOptions = answer.selected_options

  // Calculate correct and incorrect selections
  const correctSelections = selectedOptions.filter(id => correctOptionIds.includes(id)).length
  const incorrectSelections = selectedOptions.filter(id => !correctOptionIds.includes(id)).length
  const missedCorrect = correctOptionIds.length - correctSelections

  // Partial credit formula: (correct - incorrect) / total correct options
  const score = Math.max(0, (correctSelections - incorrectSelections) / correctOptionIds.length)
  const marksObtained = Math.round(score * question.marks * 100) / 100

  const isCorrect = correctSelections === correctOptionIds.length && incorrectSelections === 0

  return {
    isCorrect,
    marksObtained,
    needsManualGrading: false,
    feedback: isCorrect 
      ? 'All correct!' 
      : `Partial credit: ${correctSelections} correct, ${incorrectSelections} incorrect`
  }
}

/**
 * Grade True/False questions
 */
function gradeTrueFalse(question: QuizQuestion, answer: QuizAnswer): AutoGradeResult {
  const studentAnswer = answer.text_answer?.toLowerCase().trim()
  const correctAnswer = question.correct_answer.toLowerCase().trim()
  
  const isCorrect = studentAnswer === correctAnswer
  
  return {
    isCorrect,
    marksObtained: isCorrect ? question.marks : 0,
    needsManualGrading: false,
    feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${correctAnswer}`
  }
}

/**
 * Grade short text answers with keyword matching
 */
function gradeShortText(question: QuizQuestion, answer: QuizAnswer): AutoGradeResult {
  if (!answer.text_answer) {
    return {
      isCorrect: false,
      marksObtained: 0,
      needsManualGrading: false,
      feedback: 'No answer provided'
    }
  }

  const studentAnswer = answer.text_answer.toLowerCase().trim()
  const correctAnswer = question.correct_answer.toLowerCase().trim()

  // Exact match (case-insensitive)
  if (studentAnswer === correctAnswer) {
    return {
      isCorrect: true,
      marksObtained: question.marks,
      needsManualGrading: false,
      feedback: 'Correct!'
    }
  }

  // Keyword matching if keywords are provided
  if (question.keywords && question.keywords.length > 0) {
    const matchedKeywords = question.keywords.filter(keyword =>
      studentAnswer.includes(keyword.toLowerCase())
    )

    const matchPercentage = matchedKeywords.length / question.keywords.length

    // If 80% or more keywords match, give partial credit
    if (matchPercentage >= 0.8) {
      const marksObtained = Math.round(matchPercentage * question.marks * 100) / 100
      return {
        isCorrect: matchPercentage === 1,
        marksObtained,
        needsManualGrading: true, // Still flag for teacher review
        feedback: `Partial match (${matchedKeywords.length}/${question.keywords.length} keywords). Flagged for teacher review.`
      }
    }
  }

  // If no exact match and no keywords, flag for manual grading
  return {
    isCorrect: false,
    marksObtained: 0,
    needsManualGrading: true,
    feedback: 'Flagged for teacher review'
  }
}

/**
 * Flag question for manual grading
 */
function flagForManualGrading(question: QuizQuestion): AutoGradeResult {
  return {
    isCorrect: false,
    marksObtained: 0,
    needsManualGrading: true,
    feedback: 'This question requires manual grading by your teacher'
  }
}

/**
 * Grade an entire quiz attempt
 */
export async function gradeQuizAttempt(attemptId: string): Promise<{
  totalMarks: number
  autoGradedMarks: number
  manualGradingRequired: boolean
  gradedAnswers: number
  totalAnswers: number
}> {
  // Fetch all answers for this attempt
  const { data: answers } = await supabase
    .from('quiz_answers')
    .select(`
      *,
      question:quiz_questions(*)
    `)
    .eq('attempt_id', attemptId)

  if (!answers || answers.length === 0) {
    return {
      totalMarks: 0,
      autoGradedMarks: 0,
      manualGradingRequired: false,
      gradedAnswers: 0,
      totalAnswers: 0
    }
  }

  let totalMarks = 0
  let autoGradedMarks = 0
  let manualGradingRequired = false
  let gradedAnswers = 0

  // Grade each answer
  for (const answer of answers) {
    const question = answer.question

    if (!question) continue

    const gradeResult = await autoGradeAnswer(question, answer)

    // Update the answer in database
    await supabase
      .from('quiz_answers')
      .update({
        is_correct: gradeResult.isCorrect,
        marks_obtained: gradeResult.marksObtained,
        auto_graded: !gradeResult.needsManualGrading,
        needs_manual_grading: gradeResult.needsManualGrading,
        teacher_feedback: gradeResult.feedback
      })
      .eq('id', answer.id)

    totalMarks += gradeResult.marksObtained
    
    if (!gradeResult.needsManualGrading) {
      autoGradedMarks += gradeResult.marksObtained
      gradedAnswers++
    } else {
      manualGradingRequired = true
    }
  }

  // Update the attempt with auto-graded marks
  await supabase
    .from('quiz_attempts')
    .update({
      auto_graded_marks: autoGradedMarks,
      total_marks_obtained: totalMarks,
      status: manualGradingRequired ? 'submitted' : 'graded'
    })
    .eq('id', attemptId)

  return {
    totalMarks,
    autoGradedMarks,
    manualGradingRequired,
    gradedAnswers,
    totalAnswers: answers.length
  }
}

/**
 * Submit quiz and trigger auto-grading
 */
export async function submitQuiz(attemptId: string): Promise<{
  success: boolean
  results?: {
    totalMarks: number
    autoGradedMarks: number
    manualGradingRequired: boolean
  }
  error?: string
}> {
  try {
    // Mark attempt as submitted
    const { error: updateError } = await supabase
      .from('quiz_attempts')
      .update({
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      })
      .eq('id', attemptId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Auto-grade the attempt
    const results = await gradeQuizAttempt(attemptId)

    return {
      success: true,
      results: {
        totalMarks: results.totalMarks,
        autoGradedMarks: results.autoGradedMarks,
        manualGradingRequired: results.manualGradingRequired
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit quiz'
    }
  }
}
