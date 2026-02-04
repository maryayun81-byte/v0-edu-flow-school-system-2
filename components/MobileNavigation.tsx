"use client"

import React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, 
  BookOpen, 
  Calendar, 
  Trophy, 
  User, 
  Bell,
  FileText,
  Users,
  Settings,
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  Menu,
  X,
  MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type UserRole = 'student' | 'teacher' | 'admin'

interface NavItem {
  icon: React.ReactNode
  label: string
  href: string
  badge?: number
}

const studentNavItems: NavItem[] = [
  { icon: <Home className="h-5 w-5" />, label: "Home", href: "/student/dashboard" },
  { icon: <BookOpen className="h-5 w-5" />, label: "Notes", href: "/student/notes" },
  { icon: <Calendar className="h-5 w-5" />, label: "Schedule", href: "/student/schedule" },
  { icon: <Trophy className="h-5 w-5" />, label: "Quizzes", href: "/student/quizzes" },
  { icon: <User className="h-5 w-5" />, label: "Profile", href: "/student/profile" },
]

const teacherNavItems: NavItem[] = [
  { icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard", href: "/teacher/dashboard" },
  { icon: <FileText className="h-5 w-5" />, label: "Notes", href: "/teacher/notes" },
  { icon: <ClipboardList className="h-5 w-5" />, label: "Assignments", href: "/teacher/assignments" },
  { icon: <Trophy className="h-5 w-5" />, label: "Quizzes", href: "/teacher/quizzes" },
  { icon: <Users className="h-5 w-5" />, label: "Students", href: "/teacher/students" },
]

const adminNavItems: NavItem[] = [
  { icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard", href: "/admin/dashboard" },
  { icon: <Users className="h-5 w-5" />, label: "Teachers", href: "/admin/teachers" },
  { icon: <GraduationCap className="h-5 w-5" />, label: "Students", href: "/admin/students" },
  { icon: <BookOpen className="h-5 w-5" />, label: "Classes", href: "/admin/classes" },
  { icon: <Settings className="h-5 w-5" />, label: "Settings", href: "/admin/settings" },
]

const moreMenuItems = {
  student: [
    { icon: <FileText className="h-5 w-5" />, label: "Assignments", href: "/student/assignments" },
    { icon: <MessageSquare className="h-5 w-5" />, label: "Messages", href: "/student/messages" },
    { icon: <Bell className="h-5 w-5" />, label: "Notifications", href: "/student/notifications" },
    { icon: <Settings className="h-5 w-5" />, label: "Settings", href: "/student/settings" },
  ],
  teacher: [
    { icon: <Calendar className="h-5 w-5" />, label: "Timetable", href: "/teacher/timetable" },
    { icon: <MessageSquare className="h-5 w-5" />, label: "Messages", href: "/teacher/messages" },
    { icon: <Bell className="h-5 w-5" />, label: "Notifications", href: "/teacher/notifications" },
    { icon: <User className="h-5 w-5" />, label: "Profile", href: "/teacher/profile" },
  ],
  admin: [
    { icon: <FileText className="h-5 w-5" />, label: "Reports", href: "/admin/reports" },
    { icon: <MessageSquare className="h-5 w-5" />, label: "Messages", href: "/admin/messages" },
    { icon: <Bell className="h-5 w-5" />, label: "Notifications", href: "/admin/notifications" },
  ],
}

interface MobileNavigationProps {
  role: UserRole
  unreadNotifications?: number
}

export function MobileNavigation({ role, unreadNotifications = 0 }: MobileNavigationProps) {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const navItems = role === 'student' 
    ? studentNavItems 
    : role === 'teacher' 
      ? teacherNavItems 
      : adminNavItems

  const extraItems = moreMenuItems[role]

  const isActive = (href: string) => {
    return pathname === href
  }

  return (
    <>
      {/* Bottom Navigation Bar - Only visible on mobile */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 safe-area-inset-bottom",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
        
        <div className="relative flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                isActive(item.href)
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <div className="relative">
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-rose-500">
                    {item.badge > 9 ? '9+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </Link>
          ))}
          
          {/* More menu button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                  "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <div className="relative">
                  <Menu className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-rose-500">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] mt-1 font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-3xl">
              <SheetHeader className="pb-4">
                <SheetTitle className="text-left">More Options</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-4 pb-8">
                {extraItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                      {item.icon}
                    </div>
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-20 md:hidden" />
    </>
  )
}

// Touch gesture hook for swipe navigation
export function useSwipeNavigation(onSwipeLeft: () => void, onSwipeRight: () => void) {
  useEffect(() => {
    let touchStartX = 0
    let touchEndX = 0
    const minSwipeDistance = 50

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX
      const distance = touchEndX - touchStartX
      
      if (Math.abs(distance) > minSwipeDistance) {
        if (distance > 0) {
          onSwipeRight()
        } else {
          onSwipeLeft()
        }
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onSwipeLeft, onSwipeRight])
}

// Pull to refresh hook
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullProgress, setPullProgress] = useState(0)

  useEffect(() => {
    let startY = 0
    const threshold = 80

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0 || isRefreshing) return
      
      const currentY = e.touches[0].clientY
      const diff = currentY - startY
      
      if (diff > 0 && window.scrollY === 0) {
        const progress = Math.min(diff / threshold, 1)
        setPullProgress(progress)
      }
    }

    const handleTouchEnd = async () => {
      if (pullProgress >= 1 && !isRefreshing) {
        setIsRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
        }
      }
      startY = 0
      setPullProgress(0)
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, isRefreshing, pullProgress])

  return { isRefreshing, pullProgress }
}
