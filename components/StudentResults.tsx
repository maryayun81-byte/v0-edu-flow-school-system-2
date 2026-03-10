"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trophy, CheckCircle, ChevronRight,FileText, Brain, Sparkles, TrendingUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudentTranscriptViewer from "@/components/StudentTranscriptViewer";
import { CognitiveCore } from "@/lib/ai/CognitiveCore";
import { TrajectoryForecaster } from "@/lib/ai/TrajectoryForecaster";

const supabase = createClient();

interface StudentResultsProps {
  studentId: string;
}

export default function StudentResults({ studentId }: StudentResultsProps) {
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<"All" | "Tuition" | "Exam">("All");
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [overallInsight, setOverallInsight] = useState<string | null>(null);
  const [examSpecificInsight, setExamSpecificInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchTranscripts();
    loadOverallInsights();
  }, [studentId]);

  async function fetchTranscripts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transcripts")
      .select(`
        *,
        exams!inner(
          id,
          exam_name, 
          academic_year, 
          term, 
          start_date, 
          end_date,
          tuition_event_id
        ),
        transcript_items(subject_name)
      `)
      .eq("student_id", studentId)
      .eq("status", "Published")
      .order("published_at", { ascending: false });

    if (data) {
      setTranscripts(data);
    } else if (error) {
      console.error("Error fetching transcripts:", error);
    }
    setLoading(false);
  }

  async function loadOverallInsights() {
    try {
      const insights = await CognitiveCore.getInsightsForDashboard(studentId, 'student', ['success']);
      if (insights.length > 0) {
        setOverallInsight(insights[0].insight_text);
      }
    } catch (error) {
      console.error("Error loading overall insights:", error);
    }
  }

  const filteredTranscripts = transcripts.filter((t: any) => {
    if (!t.exams) return false;
    
    // Type Filter
    if (eventTypeFilter === "Tuition" && !t.exams.tuition_event_id) return false;
    if (eventTypeFilter === "Exam" && t.exams.tuition_event_id) return false;
    
    // Specific Event Filter
    if (selectedEventId !== "all" && t.exams.id !== selectedEventId) return false;
    
    return true;
  });

  // Calculate unique events for the second dropdown based on type
  const availableEvents = Array.from(new Set(
    transcripts
      .filter(t => {
        if (eventTypeFilter === "Tuition") return !!t.exams.tuition_event_id;
        if (eventTypeFilter === "Exam") return !t.exams.tuition_event_id;
        return true;
      })
      .map(t => JSON.stringify({ id: t.exams.id, name: t.exams.exam_name }))
  )).map(s => JSON.parse(s));

  // Pagination Logic
  const totalPages = Math.ceil(filteredTranscripts.length / pageSize);
  const paginatedTranscripts = filteredTranscripts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (grade.startsWith('B')) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    if (grade.startsWith('C')) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    if (grade.startsWith('D')) return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    return "text-destructive bg-destructive/10 border-destructive/20";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Transcript Viewer Modal */}
      {selectedTranscriptId && (
        <StudentTranscriptViewer
          transcriptId={selectedTranscriptId}
          onClose={() => setSelectedTranscriptId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-3xl font-black text-foreground tracking-tighter">Academic Records</h2>
           <p className="text-sm text-muted-foreground font-medium italic">Your verified performance history</p>
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.2em] border border-primary/20">
          {filteredTranscripts.length} Records found
        </div>
      </div>

      {/* Premium Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-card/50 p-6 rounded-[2rem] border border-border/40 backdrop-blur-xl shadow-sm">
        <div className="space-y-2">
           <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Event Type</label>
           <select
             value={eventTypeFilter}
             onChange={(e) => {
               setEventTypeFilter(e.target.value as any);
               setSelectedEventId("all");
               setCurrentPage(1);
             }}
             className="w-full h-11 px-4 bg-background border border-border/50 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
           >
             <option value="All">All Events</option>
             <option value="Tuition">Tuition Events</option>
             <option value="Exam">Exam Events</option>
           </select>
        </div>
        
        <div className="space-y-2">
           <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Select Event</label>
           <select
             value={selectedEventId}
             onChange={(e) => {
               setSelectedEventId(e.target.value);
               setCurrentPage(1);
             }}
             disabled={availableEvents.length === 0}
             className="w-full h-11 px-4 bg-background border border-border/50 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
           >
             <option value="all">All Available</option>
             {availableEvents.map((event) => (
               <option key={event.id} value={event.id}>{event.name}</option>
             ))}
           </select>
        </div>

        <div className="space-y-2 lg:col-start-4">
           <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Per Page</label>
           <div className="flex items-center gap-2">
              {[10, 20, 50].map(size => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`flex-1 h-11 rounded-xl text-xs font-black transition-all border ${
                    pageSize === size 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background text-muted-foreground border-border/50 hover:bg-muted"
                  }`}
                >
                  {size}
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Transcript Results Grid - Compact Premium Cards */}
      {paginatedTranscripts.length === 0 ? (
        <div className="text-center py-24 bg-card/30 border border-dashed border-border/60 rounded-[3rem]">
          <Trophy className="w-16 h-16 text-muted-foreground/30 mx-auto mb-6" />
          <p className="text-xl font-bold text-foreground">No Records Identified</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto italic">
             No academic transcripts match your current filter settings.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
           {paginatedTranscripts.map((transcript: any) => (
            <div
              key={transcript.id}
              className="group relative bg-card h-full border border-border/50 rounded-[2.5rem] p-6 sm:p-8 hover:shadow-2xl hover:border-primary/40 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col"
              onClick={() => setSelectedTranscriptId(transcript.id)}
            >
              {/* Premium Background Glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[80px] -mr-24 -mt-24 group-hover:bg-primary/10 transition-all duration-700" />
              
              <div className="relative z-10 flex flex-col h-full space-y-6">
                 {/* Header: Title & Grade */}
                 <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                       <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-primary/20 bg-primary/5 text-primary`}>
                             {transcript.exams.term} • {transcript.exams.academic_year}
                          </span>
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${transcript.exams.tuition_event_id ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-600/10 text-blue-600 border-blue-600/20'}`}>
                             {transcript.exams.tuition_event_id ? 'Tuition' : 'Exam'}
                          </span>
                       </div>
                       <h3 className="text-2xl font-black text-foreground tracking-tighter leading-none group-hover:text-primary transition-colors">
                          {transcript.exams.exam_name}
                       </h3>
                    </div>
                    <div className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] border-2 flex flex-col items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform duration-500 ${getGradeColor(transcript.overall_grade)}`}>
                       <span className="text-[10px] font-black opacity-60 uppercase mb-0.5">Grade</span>
                       <span className="text-2xl sm:text-3xl font-black tracking-tighter leading-none">{transcript.overall_grade}</span>
                    </div>
                 </div>

                 {/* Information Grid */}
                 <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 transition-colors group-hover:bg-muted/50">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Average</p>
                       <p className="text-xl font-black text-foreground">{transcript.average_score.toFixed(1)}%</p>
                    </div>
                    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 transition-colors group-hover:bg-muted/50">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Class Position</p>
                       <p className="text-xl font-black text-foreground flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          {transcript.class_position}
                       </p>
                    </div>
                 </div>

                 {/* Subjects Highlight */}
                 <div className="flex-1">
                    <div className="bg-muted/30 rounded-[2rem] p-5 border border-border/50 relative overflow-hidden group-hover:bg-muted/50 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                           <FileText className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Academic Subjects</p>
                        <div className="flex flex-wrap gap-2">
                           {(transcript.transcript_items || []).slice(0, 5).map((item: any, idx: number) => (
                             <span key={idx} className="text-[11px] font-bold text-foreground/80 bg-background/80 px-3 py-1 rounded-lg border border-border/50">
                                {item.subject_name}
                             </span>
                           ))}
                           {(transcript.transcript_items?.length || 0) > 5 && (
                             <span className="text-[11px] font-black text-primary px-2 py-1">
                                +{transcript.transcript_items.length - 5} More
                             </span>
                           )}
                        </div>
                    </div>
                 </div>

                 {/* Footer Action */}
                 <div className="pt-4 mt-auto border-t border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          Published {new Date(transcript.published_at).toLocaleDateString()}
                       </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/5 text-primary border border-primary/10 hover:bg-primary hover:text-white transition-all shadow-sm"
                    >
                       Open Report
                       <ChevronRight className="w-3 h-3 ml-2" />
                    </Button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Premium Pagination Support */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-8">
           <Button
             variant="outline"
             size="sm"
             disabled={currentPage === 1}
             onClick={() => setCurrentPage(prev => prev - 1)}
             className="px-4 rounded-xl border-border/50 text-xs font-black uppercase tracking-widest"
           >
             Previous
           </Button>
           
           <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                    currentPage === page 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {page}
                </button>
              ))}
           </div>

           <Button
             variant="outline"
             size="sm"
             disabled={currentPage === totalPages}
             onClick={() => setCurrentPage(prev => prev + 1)}
             className="px-4 rounded-xl border-border/50 text-xs font-black uppercase tracking-widest"
           >
             Next
           </Button>
        </div>
      )}
    </div>
  );
}
