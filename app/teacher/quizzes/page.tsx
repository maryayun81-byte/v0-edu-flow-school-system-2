"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import QuizBuilder from '@/components/QuizBuilder'
import QuizGrading from '@/components/quiz/QuizGrading'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Clock,
  CheckCircle2,
  BarChart3,
  Eye
} from 'lucide-react'
import { subscribeToQuizSubmissions } from '@/lib/quiz/realtime-quiz'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TeacherQuizzesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showGrading, setShowGrading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('published')

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchQuizzes()
    }
  }, [userId, activeTab])

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
    }
  }

  async function fetchQuizzes() {
    setLoading(true)
    
    let query = supabase
      .from('quizzes')
      .select(`
        *,
        _count:quiz_attempts(count)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (activeTab !== 'all') {
      query = query.eq('status', activeTab)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching quizzes:', error)
      setLoading(false)
      return
    }

    // Fetch attempt counts and stats for each quiz
    const quizzesWithStats = await Promise.all(
      (data || []).map(async (quiz) => {
        const { count: attemptCount } = await supabase
          .from('quiz_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('quiz_id', quiz.id)

        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('total_marks_obtained')
          .eq('quiz_id', quiz.id)
          .eq('status', 'graded')

        const avgScore = attempts && attempts.length > 0
          ? attempts.reduce((sum, a) => sum + (a.total_marks_obtained || 0), 0) / attempts.length
          : 0

        return {
          ...quiz,
          attempt_count: attemptCount || 0,
          avg_score: Math.round(avgScore * 10) / 10
        }
      })
    )

    setQuizzes(quizzesWithStats)
    setLoading(false)
  }

  if (showBuilder) {
    return (
      <div className="container mx-auto py-6">
        <QuizBuilder 
          userId={userId} 
          onClose={() => {
            setShowBuilder(false)
            fetchQuizzes()
          }} 
        />
      </div>
    )
  }

  if (showGrading) {
    return (
      <div className="container mx-auto py-6">
        <QuizGrading
          quizId={showGrading}
          teacherId={userId}
          onClose={() => {
            setShowGrading(null)
            fetchQuizzes()
          }}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Quiz Management</h1>
          <p className="text-muted-foreground">Create, manage, and grade quizzes</p>
        </div>
        <Button onClick={() => setShowBuilder(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Quiz
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading quizzes...</p>
            </div>
          ) : quizzes.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No quizzes found</p>
              <Button onClick={() => setShowBuilder(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Quiz
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((quiz) => (
                <Card key={quiz.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{quiz.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {quiz.description || 'No description'}
                      </p>
                    </div>
                    <Badge variant={
                      quiz.status === 'published' ? 'default' :
                      quiz.status === 'draft' ? 'secondary' : 'outline'
                    }>
                      {quiz.status}
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
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Attempts
                      </span>
                      <span className="font-medium">{quiz.attempt_count}</span>
                    </div>
                    {quiz.avg_score > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Avg Score</span>
                        <span className="font-medium text-primary">{quiz.avg_score}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowGrading(quiz.id)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Grade
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/teacher/quizzes/${quiz.id}/results`)}
                    >
                      <BarChart3 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/teacher/quizzes/${quiz.id}/edit`)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
