"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import MessagingCenter from '@/components/MessagingCenter'
import { MobileNavigation } from '@/components/MobileNavigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminMessagesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/admin/login')
      return
    }

    setUserId(user.id)
    setUserName(user.email || 'Admin')
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Messages</h1>
              <p className="text-sm text-muted-foreground">Chat with teachers and students</p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Content */}
      <main className="container mx-auto px-4 py-6 pb-24">
        <MessagingCenter
          userId={userId}
          userRole="admin"
          userName={userName}
        />
      </main>

      {/* Mobile Navigation */}
      <MobileNavigation role="admin" />
    </div>
  )
}
