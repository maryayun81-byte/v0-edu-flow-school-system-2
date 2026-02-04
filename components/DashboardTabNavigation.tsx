'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number | null;
}

interface DashboardTabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function DashboardTabNavigation({ tabs, activeTab, onTabChange }: DashboardTabNavigationProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const primaryTabs = tabs.slice(0, 4);
  const secondaryTabs = tabs.slice(4);

  return (
    <>
      {/* Desktop/Tablet - Top Navigation Tabs */}
      <div className="hidden lg:flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span className={cn(
                "ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold",
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile - Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden safe-area-inset-bottom">
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
        
        <div className="relative flex items-center justify-around px-2 py-2">
          {primaryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setShowMoreMenu(false);
              }}
              className={cn(
                "relative flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                activeTab === tab.id
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                {tab.count !== undefined && tab.count !== null && tab.count > 0 && (
                   <span className="absolute -top-2 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold px-1 rounded-full border border-background">
                     {tab.count > 99 ? '99+' : tab.count}
                   </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
            </button>
          ))}

          {/* More Button */}
          {secondaryTabs.length > 0 && (
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200",
                showMoreMenu || secondaryTabs.some(t => t.id === activeTab)
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-xl leading-none font-bold mb-2">...</span>
              </div>
              <span className="text-[10px] mt-1 font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile More Menu Overlay */}
      {showMoreMenu && (
        <div 
          className="fixed inset-0 z-[60] lg:hidden bg-background/80 backdrop-blur-sm"
          onClick={() => setShowMoreMenu(false)}
        >
          <div 
            className="absolute bottom-20 left-4 right-4 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2 p-4">
              {secondaryTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    // Decouple state updates to prevent React reconciliation errors (removeChild)
                    setShowMoreMenu(false);
                    // Slight delay to allow menu to unmount cleanly before heavy tab switch
                    setTimeout(() => onTabChange(tab.id), 50);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <tab.icon className="w-6 h-6" />
                  <span className="text-xs font-medium text-center line-clamp-1">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacer to prevent content from being hidden behind bottom nav on mobile is handled by page padding now */}
    </>
  );
}
