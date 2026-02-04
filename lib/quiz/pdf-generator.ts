// Premium PDF Report Generator for Quiz Results
// Generates professional, branded PDF reports for students

import jsPDF from 'jspdf'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface QuizReportData {
  student: {
    name: string
    email?: string
    class?: string
  }
  quiz: {
    title: string
    description?: string
    total_marks: number
  }
  attempt: {
    submitted_at: string
    total_marks_obtained: number
    time_spent_seconds?: number
    teacher_remarks?: string
  }
  answers: Array<{
    question_number: number
    question_text: string
    marks: number
    marks_obtained: number
    is_correct: boolean
    student_answer?: string
    correct_answer?: string
    teacher_feedback?: string
  }>
}

export async function generateQuizPDFReport(attemptId: string): Promise<void> {
  // Fetch all data
  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select(`
      *,
      quiz:quizzes(*),
      student:auth.users!quiz_attempts_student_id_fkey(
        id,
        email,
        raw_user_meta_data
      ),
      answers:quiz_answers(
        *,
        question:quiz_questions(*)
      )
    `)
    .eq('id', attemptId)
    .single()

  if (!attempt) {
    throw new Error('Quiz attempt not found')
  }

  // Prepare data
  const reportData: QuizReportData = {
    student: {
      name: attempt.student?.raw_user_meta_data?.full_name || 'Unknown Student',
      email: attempt.student?.email,
      class: attempt.student?.raw_user_meta_data?.class
    },
    quiz: {
      title: attempt.quiz.title,
      description: attempt.quiz.description,
      total_marks: attempt.quiz.total_marks
    },
    attempt: {
      submitted_at: attempt.submitted_at,
      total_marks_obtained: attempt.total_marks_obtained || 0,
      time_spent_seconds: attempt.time_spent_seconds,
      teacher_remarks: attempt.teacher_remarks
    },
    answers: attempt.answers
      .sort((a: any, b: any) => a.question.question_number - b.question.question_number)
      .map((answer: any, index: number) => ({
        question_number: index + 1,
        question_text: answer.question.question_text,
        marks: answer.question.marks,
        marks_obtained: answer.marks_obtained || 0,
        is_correct: answer.is_correct || false,
        student_answer: answer.text_answer,
        correct_answer: answer.question.correct_answer,
        teacher_feedback: answer.teacher_feedback
      }))
  }

  // Generate PDF
  await createPDF(reportData)
}

async function createPDF(data: QuizReportData): Promise<void> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPos = 20

  // Colors
  const primaryColor: [number, number, number] = [99, 102, 241] // Indigo
  const successColor: [number, number, number] = [34, 197, 94] // Green
  const errorColor: [number, number, number] = [239, 68, 68] // Red
  const grayColor: [number, number, number] = [107, 114, 128] // Gray

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage()
      yPos = 20
      return true
    }
    return false
  }

  // Header with gradient effect (simulated with rectangles)
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, pageWidth, 50, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('Peak Performance Tutoring', pageWidth / 2, 20, { align: 'center' })
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text('Quiz Performance Report', pageWidth / 2, 35, { align: 'center' })

  yPos = 65

  // Student Information Section
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Student Information', 20, yPos)
  yPos += 10

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
  
  doc.text(`Name:`, 20, yPos)
  doc.setTextColor(0, 0, 0)
  doc.text(data.student.name, 60, yPos)
  yPos += 7

  if (data.student.email) {
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
    doc.text(`Email:`, 20, yPos)
    doc.setTextColor(0, 0, 0)
    doc.text(data.student.email, 60, yPos)
    yPos += 7
  }

  if (data.student.class) {
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
    doc.text(`Class:`, 20, yPos)
    doc.setTextColor(0, 0, 0)
    doc.text(data.student.class, 60, yPos)
    yPos += 7
  }

  yPos += 5

  // Quiz Information Section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Quiz Details', 20, yPos)
  yPos += 10

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
  
  doc.text(`Title:`, 20, yPos)
  doc.setTextColor(0, 0, 0)
  doc.text(data.quiz.title, 60, yPos)
  yPos += 7

  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
  doc.text(`Date:`, 20, yPos)
  doc.setTextColor(0, 0, 0)
  doc.text(new Date(data.attempt.submitted_at).toLocaleDateString(), 60, yPos)
  yPos += 7

  if (data.attempt.time_spent_seconds) {
    const minutes = Math.floor(data.attempt.time_spent_seconds / 60)
    const seconds = data.attempt.time_spent_seconds % 60
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
    doc.text(`Time Taken:`, 20, yPos)
    doc.setTextColor(0, 0, 0)
    doc.text(`${minutes}m ${seconds}s`, 60, yPos)
    yPos += 7
  }

  yPos += 5

  // Score Summary Box
  checkNewPage(40)
  
  const percentage = Math.round((data.attempt.total_marks_obtained / data.quiz.total_marks) * 100)
  const isPassing = percentage >= 50 // Assuming 50% is passing
  
  doc.setFillColor(isPassing ? successColor[0] : errorColor[0], 
                   isPassing ? successColor[1] : errorColor[1], 
                   isPassing ? successColor[2] : errorColor[2])
  doc.roundedRect(20, yPos, pageWidth - 40, 30, 3, 3, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Final Score', pageWidth / 2, yPos + 12, { align: 'center' })
  
  doc.setFontSize(24)
  doc.text(
    `${data.attempt.total_marks_obtained} / ${data.quiz.total_marks}`,
    pageWidth / 2,
    yPos + 24,
    { align: 'center' }
  )
  
  yPos += 40

  // Percentage and Grade
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(12)
  doc.text(`Percentage: ${percentage}%`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 7
  
  const grade = getGrade(percentage)
  doc.text(`Grade: ${grade}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  // Teacher Remarks (if any)
  if (data.attempt.teacher_remarks) {
    checkNewPage(30)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Teacher Remarks', 20, yPos)
    yPos += 10

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
    
    const remarks = doc.splitTextToSize(data.attempt.teacher_remarks, pageWidth - 40)
    doc.text(remarks, 20, yPos)
    yPos += remarks.length * 7 + 10
  }

  // Question-wise Breakdown
  checkNewPage(20)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Question-wise Performance', 20, yPos)
  yPos += 12

  // Table header
  doc.setFillColor(240, 240, 240)
  doc.rect(20, yPos - 5, pageWidth - 40, 10, 'F')
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Q#', 25, yPos)
  doc.text('Question', 40, yPos)
  doc.text('Marks', pageWidth - 60, yPos)
  doc.text('Status', pageWidth - 30, yPos)
  yPos += 10

  // Questions
  doc.setFont('helvetica', 'normal')
  data.answers.forEach((answer, index) => {
    checkNewPage(35)

    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(20, yPos - 5, pageWidth - 40, 30, 'F')
    }

    // Question number
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.text(`${answer.question_number}`, 25, yPos)

    // Question text (truncated)
    const questionText = answer.question_text.length > 60
      ? answer.question_text.substring(0, 60) + '...'
      : answer.question_text
    doc.text(questionText, 40, yPos, { maxWidth: pageWidth - 120 })

    // Marks
    doc.text(
      `${answer.marks_obtained}/${answer.marks}`,
      pageWidth - 60,
      yPos
    )

    // Status icon
    if (answer.is_correct) {
      doc.setTextColor(successColor[0], successColor[1], successColor[2])
      doc.text('✓', pageWidth - 30, yPos)
    } else {
      doc.setTextColor(errorColor[0], errorColor[1], errorColor[2])
      doc.text('✗', pageWidth - 30, yPos)
    }

    yPos += 7

    // Teacher feedback (if any)
    if (answer.teacher_feedback) {
      doc.setFontSize(9)
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
      doc.setFont('helvetica', 'italic')
      const feedback = doc.splitTextToSize(`Feedback: ${answer.teacher_feedback}`, pageWidth - 80)
      doc.text(feedback, 40, yPos)
      yPos += feedback.length * 5
      doc.setFont('helvetica', 'normal')
    }

    yPos += 8
  })

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
    doc.text(
      `Generated on ${new Date().toLocaleDateString()}`,
      pageWidth - 20,
      pageHeight - 10,
      { align: 'right' }
    )
  }

  // Save the PDF
  const fileName = `quiz-report-${data.student.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`
  doc.save(fileName)
}

function getGrade(percentage: number): string {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B+'
  if (percentage >= 60) return 'B'
  if (percentage >= 50) return 'C'
  if (percentage >= 40) return 'D'
  return 'F'
}
