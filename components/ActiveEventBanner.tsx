"use client";

import { useEffect, useState } from "react";
import { Calendar, Info, Zap } from "lucide-react";
import { format } from "date-fns";
import { ResultsCognitiveCore } from "@/lib/ai/ResultsCognitiveCore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ActiveEventBanner({ children }: { children?: React.ReactNode }) {
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvent() {
      // Sync statuses first to ensure we have the latest
      await ResultsCognitiveCore.syncEventStatuses();
      const event = await ResultsCognitiveCore.getActiveEvent();
      setActiveEvent(event);
      setLoading(false);
    }
    loadEvent();
  }, []);

  if (loading || !activeEvent) return null;

  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 p-4 mb-6 shadow-sm group">
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <Zap className="h-24 w-24 text-blue-600" />
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-xs">
                Active Tuition Event
              </h3>
              <Badge variant="secondary" className="bg-blue-600/10 text-blue-700 dark:text-blue-400 border-none text-[10px] animate-pulse">
                ONGOING
              </Badge>
            </div>
            <p className="text-lg font-extrabold text-blue-700 dark:text-blue-400 leading-tight">
              {activeEvent.name || activeEvent.event_name}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-6 px-4 py-2 bg-white/50 dark:bg-slate-900/50 rounded-xl backdrop-blur-sm border border-white/20 dark:border-slate-800/50">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Starts</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {format(new Date(activeEvent.start_date), "MMM d, yyyy")}
              </p>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Ends</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {format(new Date(activeEvent.end_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </Card>
  );
}
