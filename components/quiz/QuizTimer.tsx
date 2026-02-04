"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Clock, AlertCircle } from 'lucide-react'
import { formatTime } from '@/lib/quiz/quiz-utils'

interface QuizTimerProps {
  durationMinutes?: number
  startedAt: string
  onTimeUp: () => void
  showWarning?: boolean
}

export default function QuizTimer({ 
  durationMinutes, 
  startedAt, 
  onTimeUp,
  showWarning = true 
}: QuizTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isWarning, setIsWarning] = useState(false)

  const calculateRemaining = useCallback(() => {
    if (!durationMinutes) return null

    const startTime = new Date(startedAt)
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)
    const now = new Date()

    const remainingMs = endTime.getTime() - now.getTime()
    return Math.max(0, Math.floor(remainingMs / 1000))
  }, [durationMinutes, startedAt])

  useEffect(() => {
    const remaining = calculateRemaining()
    setTimeRemaining(remaining)

    if (remaining === 0) {
      onTimeUp()
      return
    }

    const interval = setInterval(() => {
      const newRemaining = calculateRemaining()
      setTimeRemaining(newRemaining)

      // Show warning when 5 minutes or less remaining
      if (newRemaining !== null && newRemaining <= 300 && newRemaining > 0) {
        setIsWarning(true)
      }

      if (newRemaining === 0) {
        clearInterval(interval)
        onTimeUp()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [calculateRemaining, onTimeUp])

  if (!durationMinutes || timeRemaining === null) {
    return null // Untimed quiz
  }

  const totalSeconds = durationMinutes * 60
  const progress = ((totalSeconds - timeRemaining) / totalSeconds) * 100

  return (
    <Card className={`p-4 ${isWarning && showWarning ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className={`w-5 h-5 ${isWarning ? 'text-orange-500' : 'text-primary'}`} />
          <span className="font-semibold">Time Remaining</span>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${isWarning ? 'text-orange-600' : 'text-primary'}`}>
          {formatTime(timeRemaining)}
        </span>
      </div>
      
      <Progress 
        value={progress} 
        className={`h-2 ${isWarning ? 'bg-orange-200' : ''}`}
      />

      {isWarning && showWarning && (
        <div className="flex items-center gap-2 mt-3 text-sm text-orange-600">
          <AlertCircle className="w-4 h-4" />
          <span>Less than 5 minutes remaining!</span>
        </div>
      )}
    </Card>
  )
}
