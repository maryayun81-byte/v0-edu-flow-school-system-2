"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  Trophy, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Target,
  TrendingUp
} from 'lucide-react'
import { isQuizActive, canAttemptQuiz } from '@/lib/quiz/quiz-utils'
import { subscribeToNewQuizzes, subscribeToGradingUpdates } from '@/lib/quiz/realtime-quiz'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StudentQuizzesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchQuizzes()
    }
  }, [userId])

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
    }
  }

  async function fetchQuizzes() {
    setLoading(true)

    // Fetch published quizzes
    const { data: quizzesData, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching quizzes:', error)
      setLoading(false)
      return
    }

    // For each quiz, check attempts and eligibility
    const quizzesWithStatus = await Promise.all(
      (quizzesData || []).map(async (quiz) => {
        // Check if student can attempt
        const eligibility = await canAttemptQuiz(quiz.id, userId)

        // Get student's attempts
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('quiz_id', quiz.id)
          .eq('student_id', userId)
          .order('created_at', { ascending: false })

        const latestAttempt = attempts?.[0]
        const active = isQuizActive(quiz)

        return {
          ...quiz,
          canAttempt: eligibility.canAttempt,
          attemptsLeft: eligibility.attemptsLeft,
          reason: eligibility.reason,
          attempts: attempts || [],
          latestAttempt,
          isActive: active
        }
      })
    )

    setQuizzes(quizzesWithStatus)
    setLoading(false)
  }

  function getQuizStatus(quiz: any) {
    if (!quiz.isActive) {
      if (quiz.scheduled_start && new Date(quiz.scheduled_start) > new Date()) {
        return { label: 'Upcoming', variant: 'secondary' as const, icon: Calendar }
      }
      return { label: 'Closed', variant: 'outline' as const, icon: XCircle }
    }

    if (quiz.latestAttempt) {
      if (quiz.latestAttempt.status === 'graded') {
        return { label: 'Graded', variant: 'default' as const, icon: CheckCircle2 }
      }
      if (quiz.latestAttempt.status === 'submitted') {
        return { label: 'Submitted', variant: 'secondary' as const, icon: Clock }
      }
      if (quiz.latestAttempt.status === 'in_progress') {
        return { label: 'In Progress', variant: 'default' as const, icon: AlertCircle }
      }
    }

    if (quiz.canAttempt) {
      return { label: 'Available', variant: 'default' as const, icon: Target }
    }

    return { label: 'Unavailable', variant: 'outline' as const, icon: XCircle }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="text-center py-12">
          <Clock className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading quizzes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Quizzes</h1>
        <p className="text-muted-foreground">View and attempt available quizzes</p>
      </div>

      {quizzes.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No quizzes available at the moment</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const status = getQuizStatus(quiz)
            const StatusIcon = status.icon
            const percentage = quiz.latestAttempt?.total_marks_obtained
              ? Math.round((quiz.latestAttempt.total_marks_obtained / quiz.total_marks) * 100)
              : 0

            return (
              <Card key={quiz.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{quiz.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {quiz.description || 'No description'}
                    </p>
                  </div>
                  <Badge variant={status.variant} className="ml-2">
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Marks</span>
                    <span className="font-medium">{quiz.total_marks}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">
                      {quiz.duration_minutes ? `${quiz.duration_minutes} min` : 'Untimed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Attempts Left</span>
                    <span className="font-medium">
                      {quiz.attemptsLeft !== undefined ? quiz.attemptsLeft : quiz.max_attempts}
                    </span>
                  </div>

                  {quiz.latestAttempt?.status === 'graded' && (
                    <>
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Your Score</span>
                          <span className="font-bold text-primary">
                            {quiz.latestAttempt.total_marks_obtained}/{quiz.total_marks}
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                        <p className="text-xs text-center mt-1 text-muted-foreground">
                          {percentage}%
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {quiz.canAttempt && quiz.isActive ? (
                    <Button
                      className="flex-1"
                      onClick={() => router.push(`/student/quizzes/${quiz.id}/take`)}
                    >
                      <Target className="w-4 h-4 mr-2" />
                      {quiz.attempts.length > 0 ? 'Retry Quiz' : 'Start Quiz'}
                    </Button>
                  ) : quiz.latestAttempt ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.push(`/student/quizzes/${quiz.latestAttempt.id}/results`)}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      View Results
                    </Button>
                  ) : (
                    <Button variant="outline" className="flex-1" disabled>
                      {quiz.reason || 'Unavailable'}
                    </Button>
                  )}
                </div>

                {quiz.scheduled_start && new Date(quiz.scheduled_start) > new Date() && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Starts {new Date(quiz.scheduled_start).toLocaleString()}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
