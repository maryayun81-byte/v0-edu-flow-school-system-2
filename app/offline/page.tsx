'use client'

import React from 'react'
import Link from 'next/link'
import { WifiOff, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="w-32 h-32 rounded-full bg-card border-4 border-border flex items-center justify-center">
            <WifiOff className="w-16 h-16 text-muted-foreground" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-4">
          You're Offline
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8">
          It looks like you've lost your internet connection. Don't worry, some features are still available offline.
        </p>

        {/* Offline Features */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8 text-left">
          <h2 className="font-semibold text-foreground mb-4">
            Available Offline:
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              View cached messages
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              View cached notifications
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Access your profile
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              View dashboard (cached data)
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            className="w-full h-12 bg-accent hover:bg-accent/90 text-foreground font-semibold gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </Button>

          <Link href="/">
            <Button
              variant="outline"
              className="w-full h-12 border-border/50 gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Home
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground mt-8">
          Peak Performance Tutoring
        </p>
      </div>
    </div>
  )
}
