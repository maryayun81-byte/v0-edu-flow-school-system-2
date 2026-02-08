"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Types
type Term = "Term 1" | "Term 2" | "Term 3" | "Break";

interface CalendarDay {
  date: number; // 1-31
  fullDate: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  term: Term;
}

export default function StudentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Update date on mount and set up strict interval to check for day change
  useEffect(() => {
    // Set initial date
    setCurrentDate(new Date());

    // Check every minute if the day has changed
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getDate() !== currentDate.getDate()) {
        setCurrentDate(now);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [currentDate]);

  // Logic: Get Term based on month
  const getTerm = (date: Date): Term => {
    const month = date.getMonth(); // 0-11
    // jan(0) - apr(3) -> Term 1
    if (month >= 0 && month <= 3) return "Term 1";
    // may(4) - aug(7) -> Term 2
    if (month >= 4 && month <= 7) return "Term 2";
    // sep(8) - nov(10) -> Term 3
    if (month >= 8 && month <= 10) return "Term 3";
    // dec(11) -> Break
    return "Break";
  };

  // Logic: Generate calendar days
  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)

    const calendarDays: CalendarDay[] = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 1, day);
      calendarDays.push({
        date: day,
        fullDate: date,
        isCurrentMonth: false,
        isToday: false, // Can't be today if it's prev month filler in current view (unless we are at edge of month, but standard view aligns with current month)
        isPast: true,
        term: getTerm(date),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        
        // Check if today
        const isToday = 
            date.getDate() === new Date().getDate() &&
            date.getMonth() === new Date().getMonth() &&
            date.getFullYear() === new Date().getFullYear();

        // Check if past (before today, ignoring time)
        const today = new Date();
        today.setHours(0,0,0,0);
        const checkDate = new Date(date);
        checkDate.setHours(0,0,0,0);
        const isPast = checkDate < today;

        calendarDays.push({
            date: i,
            fullDate: date,
            isCurrentMonth: true,
            isToday: isToday,
            isPast: isPast,
            term: getTerm(date),
        });
    }

    // Next month filler days to complete grid (up to 42 cells typically, 6 rows)
    const totalSlots = 42; 
    const remainingSlots = totalSlots - calendarDays.length;
    
    for (let i = 1; i <= remainingSlots; i++) {
        const date = new Date(year, month + 1, i);
        calendarDays.push({
            date: i,
            fullDate: date,
            isCurrentMonth: false,
            isToday: false,
            isPast: false, // Future
            term: getTerm(date),
        });
    }

    return calendarDays;
  };

  const days = generateCalendarDays();
  const currentTerm = getTerm(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="w-full bg-card/40 backdrop-blur-md rounded-2xl border border-border/40 p-6 select-none cursor-default shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex flex-col items-center justify-center mb-6 space-y-1">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          {monthName} {year}
        </h2>
        <div 
          className={cn(
            "text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-full",
            currentTerm === "Break" 
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-primary/10 text-primary"
          )}
        >
          {currentTerm === "Break" ? "Out of Term" : currentTerm}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
        {/* Weekday Headers */}
        {weekDays.map((day) => (
          <div key={day} className="text-xs font-medium text-muted-foreground mb-2">
            {day}
          </div>
        ))}

        {/* Days */}
        {days.map((day, index) => {
            // Visual Logic
            const isBreak = day.term === "Break";
            
            // Base styles
            let cellClasses = "aspect-square flex items-center justify-center rounded-full text-sm transition-all duration-500 relative isolate";
            
            // Text Color
            if (!day.isCurrentMonth) {
                cellClasses += " text-muted-foreground/30"; // Dimmed filler days
            } else if (day.isToday) {
                cellClasses += " text-primary-foreground font-bold z-10 text-base sm:text-lg"; // Today (High contrast + Larger Text)
            } else if (day.isPast) {
                 cellClasses += " text-muted-foreground/60"; // Past days dimmed
            } else if (isBreak) {
                 cellClasses += " text-muted-foreground/80"; // Break days neutral
            } else {
                 cellClasses += " text-foreground/90"; // Future term days
            }

            return (
                <div key={index} className="flex items-center justify-center">
                    <div className={cellClasses}>
                        {/* Content */}
                        <span className="relative z-10">{day.date}</span>

                        {/* TODAY GLOW EFFECT - ENLARGED */}
                        {day.isToday && (
                            <div className="absolute inset-0 z-0">
                                <div className="absolute inset-0 bg-primary rounded-full" />
                                <div className="absolute inset-[-6px] border-2 border-primary/30 rounded-full animate-pulse" />
                                <div className="absolute inset-[-12px] border border-primary/10 rounded-full animate-[pulse_3s_ease-in-out_infinite]" />
                            </div>
                        )}
                        
                        {/* Current Term Indicator (Subtle background for non-today, current month, in-term days) */}
                        {!day.isToday && day.isCurrentMonth && !isBreak && !day.isPast && (
                             <div className="absolute inset-1 bg-primary/5 rounded-full -z-10" />
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}
