"use client";

import Link from "next/link";
import { 
  GraduationCap, 
  Users, 
  ShieldCheck, 
  ArrowRight, 
  Zap,
  BookOpen,
  Bell,
  BarChart3,
  MessageSquare,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[100px] translate-y-1/2" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-chart-3/10 rounded-full blur-[80px] -translate-x-1/2" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-foreground leading-tight">Peak Performance</span>
                <span className="text-xs text-muted-foreground">Tutoring</span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                Features
              </Link>
              <Link href="#portals" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
                Portals
              </Link>
              <Link href="/teacher/login">
                <Button variant="outline" size="sm" className="border-border/50 bg-transparent">
                  Sign In
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50 backdrop-blur-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm text-muted-foreground">Premium Tutoring Platform</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight text-balance">
            Achieve
            <span className="text-primary"> Peak Performance </span>
            in Learning
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            A premium tutoring platform connecting students and teachers 
            with real-time messaging, intelligent scheduling, and seamless collaboration.
          </p>
        </div>

        {/* Portal Cards */}
        <div id="portals" className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto">
          {/* Admin Portal */}
          <Link href="/admin/login" className="group">
            <div className="h-full bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-8 hover:border-primary/50 hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
              <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Admin</h2>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Manage teachers, classes, and system-wide settings. Assign teachers to classes and monitor performance.
              </p>
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <span>Access Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Teacher Portal */}
          <Link href="/teacher/login" className="group">
            <div className="h-full bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-8 hover:border-accent/50 hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Teacher</h2>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Create quizzes, upload notes, manage timetables, and track student progress in your assigned classes.
              </p>
              <div className="flex items-center gap-2 text-accent font-medium text-sm">
                <span>Access Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Student Portal */}
          <Link href="/student/login" className="group">
            <div className="h-full bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-8 hover:border-chart-3/50 hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:shadow-chart-3/5">
              <div className="w-14 h-14 bg-chart-3/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <GraduationCap className="w-7 h-7 text-chart-3" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Student</h2>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Access study materials, view schedules, take quizzes, and track your academic progress with your ID.
              </p>
              <div className="flex items-center gap-2 text-chart-3 font-medium text-sm">
                <span>Access Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        {/* Features Section */}
        <div id="features" className="mt-24 w-full max-w-5xl mx-auto">
          <h3 className="text-center text-2xl font-bold text-foreground mb-12">
            Premium Features for Peak Learning
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: MessageSquare, label: "Real-time Chat", desc: "Instant messaging" },
              { icon: Bell, label: "Smart Notifications", desc: "Never miss updates" },
              { icon: Target, label: "Progress Tracking", desc: "Monitor achievements" },
              { icon: GraduationCap, label: "Interactive Quizzes", desc: "Engaging assessments" },
            ].map((feature) => (
              <div 
                key={feature.label} 
                className="bg-card/30 backdrop-blur-sm border border-border/30 rounded-xl p-5 text-center hover:bg-card/50 transition-all"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground text-sm mb-1">{feature.label}</h4>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Peak Performance Tutoring - Excellence in Education</span>
            </div>
            <p className="text-xs text-muted-foreground">
              WCAG 2.1 AA Compliant
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
