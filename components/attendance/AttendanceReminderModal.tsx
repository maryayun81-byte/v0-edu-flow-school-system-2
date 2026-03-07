"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClipboardCheck, X, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

const supabase = createClient();

interface Props {
  teacherId: string;
  onMarkRegister: () => void;
  registerSubmitted: boolean;
}

export default function AttendanceReminderModal({ teacherId, onMarkRegister, registerSubmitted }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [classInfo, setClassInfo] = useState<{ id: string; name: string } | null>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [deadlineTime, setDeadlineTime] = useState<string | null>(null);
  
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInitialData();
    fetchSettings();
    
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [teacherId]);

  async function fetchInitialData() {
    // 1. Is teacher a class teacher?
    const { data: ctData } = await supabase
      .from("class_teachers")
      .select("class_id, classes(id, name)")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    if (ctData) {
      setIsClassTeacher(true);
      setClassInfo((ctData as any).classes);

      // 2. Find active event
      const today = new Date().toISOString().split("T")[0];
      const { data: eventData } = await supabase
        .from("tuition_events")
        .select("id, name, start_date, end_date")
        .lte("start_date", today)
        .gte("end_date", today)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      
      if (eventData) {
        setActiveEvent(eventData);
        checkAttendanceStatus(eventData.id, (ctData as any).class_id);
      }
    }
  }

  async function fetchSettings() {
    const { data } = await supabase
      .from("attendance_settings")
      .select("register_deadline_time")
      .maybeSingle();
    if (data) setDeadlineTime(data.register_deadline_time);
  }

  const checkAttendanceStatus = useCallback(async (eventId: string, classId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("attendance")
      .select("id")
      .eq("event_id", eventId)
      .eq("class_id", classId)
      .eq("attendance_date", today)
      .limit(1);

    if (data && data.length > 0) {
      setIsOpen(false);
    } else {
      // Hourly logic
      const lastDismissed = localStorage.getItem(`attendance_dismiss_ ${today}`);
      const oneHour = 60 * 60 * 1000;
      
      if (!lastDismissed || (Date.now() - parseInt(lastDismissed) > oneHour)) {
        setIsOpen(true);
      }
    }
  }, []);

  // Sync with prop change (if parent marks it submitted)
  useEffect(() => {
    if (registerSubmitted) {
      setIsOpen(false);
    }
  }, [registerSubmitted]);

  function handleCancel() {
    setIsOpen(false);
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem(`attendance_dismiss_${today}`, Date.now().toString());
    
    // Set up local interval to re-check in 1 hour if user stays on page
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(() => {
       if (activeEvent && classInfo) {
         checkAttendanceStatus(activeEvent.id, classInfo.id);
       }
    }, 60 * 60 * 1000);
  }

  function handleMark() {
    setIsOpen(false);
    onMarkRegister();
  }

  if (!isClassTeacher || !isOpen || registerSubmitted) return null;

  const timeDisplay = new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-border/50 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/30 rounded-xl flex items-center justify-center">
              <BellRing className="w-5 h-5 text-amber-400 animate-bounce" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Attendance Reminder</h2>
              <p className="text-xs text-muted-foreground">{timeDisplay}</p>
            </div>
          </div>
          <button onClick={handleCancel} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <ClipboardCheck className="w-6 h-6 text-amber-400 mt-1" />
            <div className="space-y-1">
              <p className="font-bold text-lg leading-tight">Please mark today's register</p>
              <p className="text-sm text-muted-foreground">
                Class: <span className="text-foreground font-semibold uppercase">{classInfo?.name}</span>
              </p>
              {deadlineTime && (
                <p className="text-xs text-amber-500/60 font-medium">
                  Daily deadline: {deadlineTime}
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed border border-border/50">
            Automated reminder: This prompt reappears every <strong className="text-foreground">1 hour</strong> until your class attendance is submitted for today.
          </div>
        </div>

        <div className="p-4 pt-0 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleCancel}>Cancel</Button>
          <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleMark}>
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Mark Now
          </Button>
        </div>
      </div>
    </div>
  );
}
