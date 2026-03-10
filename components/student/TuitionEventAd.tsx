"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  X, Calendar, MapPin, Clock, Trophy, 
  CheckCircle2, Loader2, Sparkles, Users, 
  AlertTriangle, ArrowRight, Zap 
} from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";

const supabase = createClient();

interface TuitionEvent {
  id: string;
  name: string;
  location: string;
  description: string;
  start_date: string;
  end_date: string;
  total_seats: number;
}

interface TuitionEventAdProps {
  studentId: string;
  studentProfile: any;
  onClose: () => void;
  onRegisterSuccess: () => void;
}

export default function TuitionEventAd({ 
  studentId, 
  studentProfile, 
  onClose, 
  onRegisterSuccess 
}: TuitionEventAdProps) {
  const [event, setEvent] = useState<TuitionEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    fetchLatestEvent();
  }, []);

  async function fetchLatestEvent() {
    setLoading(true);
    try {
      // 1. Fetch latest promoted active event
      const { data: events } = await supabase
        .from("tuition_events")
        .select("*")
        .eq("status", "active")
        .eq("is_promoted", true)
        .gte("end_date", new Date().toISOString().split('T')[0])
        .order("start_date", { ascending: true })
        .limit(1);

      if (events && events.length > 0) {
        const evt = events[0];
        setEvent(evt);

        // 2. Fetch total registrations for this event
        const { count } = await supabase
          .from("event_registrations")
          .select("*", { count: 'exact', head: true })
          .eq("event_id", evt.id);
        
        setRegistrationCount(count || 0);

        // 3. Fetch registrations from SAME CLASS
        if (studentProfile?.form_class) {
          const { count: cCount } = await supabase
            .from("event_registrations")
            .select("*", { count: 'exact', head: true })
            .eq("event_id", evt.id)
            .eq("class", studentProfile.form_class);
          setClassCount(cCount || 0);
        }

        // 4. Start Countdown
        startCountdown(evt.start_date);
      }
    } catch (err) {
      console.error("Error fetching event ad:", err);
    } finally {
      setLoading(false);
    }
  }

  function startCountdown(startDate: string) {
    const target = new Date(startDate).getTime();
    
    const update = () => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }

  const handleRegister = async () => {
    if (!event) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("event_registrations")
        .insert({
          student_id: studentId,
          event_id: event.id,
          name: studentProfile.full_name,
          class: studentProfile.form_class || "Unassigned",
          school: studentProfile.school_name || "EduFlow Academy",
          phone: studentProfile.phone || "",
        });

      if (error) throw error;

      // Celebrate
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      
      // Log as activity
      await supabase.from("notifications").insert({
        title: "Event Registered",
        message: `You successfully registered for ${event.name}`,
        type: "activity",
        audience: "individual",
        target_user_id: studentId,
        created_by: studentId
      });

      onRegisterSuccess();
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !event) return null;

  const seatsLeft = Math.max(0, (event.total_seats || 120) - registrationCount);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px]" />

        <div className="relative flex flex-col md:flex-row h-full">
          
          {/* Left Panel: Visual/Countdown */}
          <div className="w-full md:w-[45%] bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 text-white flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold tracking-widest uppercase mb-6 backdrop-blur-md border border-white/10">
                <Sparkles className="w-3 h-3 text-amber-300" /> Peak Performance
              </div>
              <h2 className="text-3xl font-black leading-tight mb-4">
                {event.name}
              </h2>
              <p className="text-indigo-100/80 text-sm leading-relaxed mb-6">
                Master difficult topics and boost your exam scores with elite coaching.
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4" /> ⏳ Event starts in
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Days", val: timeLeft.days },
                  { label: "Hrs", val: timeLeft.hours },
                  { label: "Min", val: timeLeft.minutes },
                  { label: "Sec", val: timeLeft.seconds }
                ].map((unit, idx) => (
                  <div key={idx} className="bg-white/10 rounded-xl p-2 text-center backdrop-blur-md border border-white/10">
                    <div className="text-xl font-black">{String(unit.val).padStart(2, '0')}</div>
                    <div className="text-[8px] uppercase font-bold opacity-60">{unit.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Content/Registration */}
          <div className="flex-1 p-8 md:p-10 bg-slate-900 flex flex-col">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-full transition-colors group"
            >
              <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
            </button>

            <div className="flex-1 space-y-8">
              {/* Event Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Date & Time</div>
                    <div className="font-semibold text-sm">
                      {new Date(event.start_date).toLocaleDateString("en-KE", { day: 'numeric', month: 'long' })} - 
                      {new Date(event.end_date).toLocaleDateString("en-KE", { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Location</div>
                    <div className="font-semibold text-sm">{event.location || "Kinoo Vocational Centre"}</div>
                  </div>
                </div>
              </div>

              {/* Social Proof */}
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-800 overflow-hidden">
                        <div className="w-full h-full bg-indigo-500/20" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    🔥 <span className="text-indigo-400 font-bold">{registrationCount} students</span> have already registered
                  </p>
                </div>
                {classCount > 0 && (
                  <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" /> 
                    {classCount} {studentProfile.form_class} students already joined
                  </p>
                )}
                {seatsLeft < 50 && (
                  <div className="flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> Only {seatsLeft} seats remaining!
                  </div>
                )}
              </div>

              {/* Prefilled Form Summary */}
              <div className="space-y-2">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Confirm Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="text-[8px] text-slate-600 font-bold uppercase">Full Name</div>
                    <div className="text-xs font-semibold text-slate-300 truncate">{studentProfile.full_name}</div>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="text-[8px] text-slate-600 font-bold uppercase">Class</div>
                    <div className="text-xs font-semibold text-slate-300">{studentProfile.form_class}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <Button 
                onClick={handleRegister}
                disabled={submitting}
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.25rem] font-black text-lg shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] group"
              >
                {submitting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    REGISTER FOR EVENT <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
              <button 
                onClick={onClose}
                className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
