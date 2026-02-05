"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Trophy, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudentTranscriptViewer from "@/components/StudentTranscriptViewer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentResultsProps {
  studentId: string;
}

export default function StudentResults({ studentId }: StudentResultsProps) {
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ year: "", term: "", exam: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTranscripts();
  }, [studentId]);

  async function fetchTranscripts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transcripts")
      .select(`
        *,
        exams!inner(exam_name, academic_year, term, start_date, end_date)
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

  const filteredTranscripts = transcripts.filter((t: any) => {
    if (filters.year && t.exams.academic_year.toString() !== filters.year) return false;
    if (filters.term && t.exams.term !== filters.term) return false;
    if (filters.exam && t.exams.exam_name !== filters.exam) return false;
    return true;
  });

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return "text-green-500 bg-green-500/10 border-green-500/30";
    if (grade.startsWith('B')) return "text-blue-500 bg-blue-500/10 border-blue-500/30";
    if (grade.startsWith('C')) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    if (grade.startsWith('D')) return "text-orange-500 bg-orange-500/10 border-orange-500/30";
    return "text-destructive bg-destructive/10 border-destructive/30";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transcript Viewer Modal */}
      {selectedTranscriptId && (
        <StudentTranscriptViewer
          transcriptId={selectedTranscriptId}
          onClose={() => setSelectedTranscriptId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Academic Results</h2>
        <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
          {transcripts.length} Transcript{transcripts.length !== 1 ? 's' : ''} Available
        </div>
      </div>

      {/* Filters */}
      {transcripts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Academic Year</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="w-full h-10 px-3 bg-card border border-border/50 rounded-lg text-foreground"
            >
              <option value="">All Years</option>
              {Array.from(new Set(transcripts.map((t: any) => t.exams.academic_year))).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Term</label>
            <select
              value={filters.term}
              onChange={(e) => setFilters({ ...filters, term: e.target.value })}
              className="w-full h-10 px-3 bg-card border border-border/50 rounded-lg text-foreground"
            >
              <option value="">All Terms</option>
              {Array.from(new Set(transcripts.map((t: any) => t.exams.term))).map((term) => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Exam</label>
            <select
              value={filters.exam}
              onChange={(e) => setFilters({ ...filters, exam: e.target.value })}
              className="w-full h-10 px-3 bg-card border border-border/50 rounded-lg text-foreground"
            >
              <option value="">All Exams</option>
              {Array.from(new Set(transcripts.map((t: any) => t.exams.exam_name))).map((exam) => (
                <option key={exam} value={exam}>{exam}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      {transcripts.length === 0 ? (
        <div className="text-center py-20 bg-gradient-to-br from-card/50 to-accent/5 backdrop-blur-xl rounded-2xl border border-border/50">
          <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-50" />
          <p className="text-xl font-semibold text-foreground mb-2">No Transcripts Available</p>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Your academic transcripts will appear here once they are published by the administration.
          </p>
        </div>
      ) : filteredTranscripts.length === 0 ? (
        <div className="text-center py-12 bg-card/50 rounded-xl border border-border/50">
          <p className="text-muted-foreground">No transcripts match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTranscripts.map((transcript: any) => (
            <div
              key={transcript.id}
              className="bg-card border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-all cursor-pointer group"
              onClick={() => setSelectedTranscriptId(transcript.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg mb-1 group-hover:text-primary transition-colors">
                    {transcript.exams.exam_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {transcript.exams.term} • {transcript.exams.academic_year}
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border font-bold text-xl ${getGradeColor(transcript.overall_grade)}`}>
                  {transcript.overall_grade}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Average</p>
                  <p className="text-lg font-bold text-foreground">{transcript.average_score.toFixed(1)}%</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Position</p>
                  <p className="text-lg font-bold text-foreground flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    {transcript.class_position}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Published</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary hover:text-primary/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTranscriptId(transcript.id);
                  }}
                >
                  View
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
