# Quiz System - Installation and Setup Guide

## 📦 Required Packages

Run this command to install all required dependencies:

```bash
pnpm add jspdf katex react-katex
pnpm add -D @types/katex
```

## 🗄️ Database Setup

### Step 1: Run the Enhancement Script

In your Supabase SQL Editor, run:

```sql
-- File: scripts/enhance-quiz-system.sql
```

This will:
- ✅ Add new columns to existing `quizzes` table
- ✅ Enhance `quiz_questions` table with new question types
- ✅ Create `quiz_question_options` table for MCQ options
- ✅ Create `quiz_answers` table for student responses
- ✅ Set up RLS policies for security
- ✅ Add triggers for auto-calculating total marks
- ✅ Enable realtime for quiz submissions

### Step 2: Verify Tables

Run this query to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'quiz%';
```

You should see:
- `quizzes`
- `quiz_questions`
- `quiz_question_options`
- `quiz_attempts`
- `quiz_answers`

## 🎯 What's Been Implemented

### ✅ Core Infrastructure

1. **Database Schema** - `scripts/enhance-quiz-system.sql`
   - Enhanced quiz tables with advanced features
   - Support for 7 question types
   - Auto/manual grading support
   - Real-time enabled

2. **Auto-Grading Engine** - `lib/quiz/auto-grader.ts`
   - MCQ single/multiple with partial credit
   - True/False questions
   - Short text with keyword matching
   - Auto-flags long text/equations for manual grading

3. **Quiz Utilities** - `lib/quiz/quiz-utils.ts`
   - Quiz validation
   - Time management
   - Statistics calculation
   - Eligibility checks

4. **Real-time System** - `lib/quiz/realtime-quiz.ts`
   - Live submission tracking
   - Grading notifications
   - New quiz alerts
   - Auto-save functionality

5. **PDF Generator** - `lib/quiz/pdf-generator.ts`
   - Premium branded reports
   - Student details
   - Question-wise breakdown
   - Teacher remarks

### ✅ UI Components

1. **QuizGrading** - `components/quiz/QuizGrading.tsx`
   - Student list with filtering
   - Question-by-question grading
   - Marks allocation
   - Feedback system
   - Auto-calculation of totals

2. **EquationEditor** - `components/quiz/EquationEditor.tsx`
   - LaTeX equation support
   - Symbol palette (20+ symbols)
   - Live preview
   - Quick reference guide

3. **QuizTimer** - `components/quiz/QuizTimer.tsx`
   - Countdown timer
   - Progress bar
   - Warning at 5 minutes
   - Auto-submit on timeout

### ✅ Pages

1. **Teacher Quizzes** - `app/teacher/quizzes/page.tsx`
   - Quiz management dashboard
   - Create/edit/delete quizzes
   - View statistics
   - Access grading interface
   - Tabs for Published/Draft/Closed

2. **Student Quizzes** - `app/student/quizzes/page.tsx`
   - Available quizzes list
   - Attempt tracking
   - Status badges
   - Score display
   - Eligibility checks

## 🔧 Integration Steps

### 1. Update QuizBuilder Component

Add equation editor support:

```tsx
import EquationEditor from '@/components/quiz/EquationEditor'

// In question editor:
{question.question_type === 'equation' && (
  <EquationEditor
    value={question.question_text}
    onChange={(latex) => updateQuestion(index, { question_text: latex })}
  />
)}
```

### 2. Update QuizPlayer Component

Add timer and auto-save:

```tsx
import QuizTimer from '@/components/quiz/QuizTimer'
import { autoSaveAnswer } from '@/lib/quiz/realtime-quiz'
import { submitQuiz } from '@/lib/quiz/auto-grader'

// Add timer
{quiz.duration_minutes && (
  <QuizTimer
    durationMinutes={quiz.duration_minutes}
    startedAt={attempt.started_at}
    onTimeUp={handleSubmit}
  />
)}

// Add auto-save
useEffect(() => {
  const interval = setInterval(async () => {
    if (currentAnswer) {
      await autoSaveAnswer(attemptId, currentQuestionId, currentAnswer)
    }
  }, 30000)
  return () => clearInterval(interval)
}, [currentAnswer])

// Update submit handler
const handleSubmit = async () => {
  const result = await submitQuiz(attemptId)
  if (result.success) {
    // Show results or navigate
  }
}
```

### 3. Add PDF Download to Results Page

```tsx
import { generateQuizPDFReport } from '@/lib/quiz/pdf-generator'

<Button onClick={() => generateQuizPDFReport(attemptId)}>
  <Download className="w-4 h-4 mr-2" />
  Download Report
</Button>
```

## 📊 Features Summary

| Feature | Status | File |
|---------|--------|------|
| Database Schema | ✅ Complete | `scripts/enhance-quiz-system.sql` |
| Auto-Grading | ✅ Complete | `lib/quiz/auto-grader.ts` |
| Manual Grading UI | ✅ Complete | `components/quiz/QuizGrading.tsx` |
| LaTeX Equations | ✅ Complete | `components/quiz/EquationEditor.tsx` |
| Quiz Timer | ✅ Complete | `components/quiz/QuizTimer.tsx` |
| PDF Reports | ✅ Complete | `lib/quiz/pdf-generator.ts` |
| Real-time Updates | ✅ Complete | `lib/quiz/realtime-quiz.ts` |
| Teacher Dashboard | ✅ Complete | `app/teacher/quizzes/page.tsx` |
| Student Dashboard | ✅ Complete | `app/student/quizzes/page.tsx` |
| File Upload | ⏳ Pending | Integration needed |
| Analytics Dashboard | ⏳ Pending | To be created |

## 🚀 Quick Start

1. **Install packages:**
   ```bash
   pnpm add jspdf katex react-katex
   ```

2. **Run database migration:**
   - Open Supabase SQL Editor
   - Run `scripts/enhance-quiz-system.sql`

3. **Test the system:**
   - Navigate to `/teacher/quizzes`
   - Create a new quiz
   - Add questions with different types
   - Publish the quiz
   - As a student, navigate to `/student/quizzes`
   - Take the quiz
   - As teacher, grade the quiz
   - Download PDF report

## 🎓 Next Steps

1. Integrate EquationEditor into QuizBuilder
2. Integrate QuizTimer into QuizPlayer
3. Add file upload for diagram questions
4. Create analytics dashboard with charts
5. Test end-to-end workflow
6. Add keyboard shortcuts for efficiency

## 📝 Notes

- The existing QuizBuilder and QuizPlayer components are preserved
- All new features are additive, no breaking changes
- Auto-grading happens automatically on submission
- Manual grading only needed for flagged questions
- PDF reports can be generated anytime after grading
