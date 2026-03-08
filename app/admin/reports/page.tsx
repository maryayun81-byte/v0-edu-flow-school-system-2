'use client';

import React from 'react';
import FinancialReportsPanel from '@/components/admin/FinancialReportsPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Share2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminReportsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Breadcrumbs / Back */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="rounded-full">
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>Autonomous Intelligence</span>
          </div>
        </div>

        {/* Page Title & Premium Header */}
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 md:p-12 text-white shadow-2xl">
          {/* Abstract background shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full -ml-16 -mb-16 blur-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary-foreground text-xs font-bold tracking-widest uppercase">
                <Share2 className="w-3 h-3" />
                Autonomous Engine Active
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                Financial <span className="text-primary italic">Intelligence</span> Reports
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed">
                Aggregated financial analytics delivered automatically at the end of every tuition event. 
                Premium PDF and CSV exports archived for compliance and strategic planning.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="pb-20">
          <FinancialReportsPanel />
        </div>

      </div>
    </div>
  );
}
