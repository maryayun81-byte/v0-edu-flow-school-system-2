"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Download,
  X,
  FileText,
  Calendar,
  Trophy,
  Printer,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Transcript {
  id: string;
  exam_id: string;
  exam_name: string;
  academic_year: number;
  term: string;
  exam_start_date: string;
  exam_end_date: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  total_score: number;
  average_score: number;
  overall_grade: string;
  class_position: number;
  admin_remarks: string;
  published_at: string;
  items: TranscriptItem[];
}

interface TranscriptItem {
  subject_name: string;
  score: number;
  max_score: number;
  grade: string;
  teacher_remarks: string;
}

interface StudentTranscriptViewerProps {
  transcriptId: string;
  onClose: () => void;
}

export default function StudentTranscriptViewer({
  transcriptId,
  onClose,
}: StudentTranscriptViewerProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTranscript();
  }, [transcriptId]);

  async function fetchTranscript() {
    try {
      // Fetch transcript with exam details
      const { data: transcriptData, error: transcriptError } = await supabase
        .from("transcripts")
        .select(`
          *,
          exams!inner(exam_name, academic_year, term, start_date, end_date),
          profiles!inner(full_name, admission_number, form_class)
        `)
        .eq("id", transcriptId)
        .eq("status", "Published")
        .single();

      if (transcriptError) throw transcriptError;

      // Fetch transcript items
      const { data: itemsData, error: itemsError } = await supabase
        .from("transcript_items")
        .select("*")
        .eq("transcript_id", transcriptId)
        .order("subject_name", { ascending: true });

      if (itemsError) throw itemsError;

      const fullTranscript: Transcript = {
        id: transcriptData.id,
        exam_id: transcriptData.exam_id,
        exam_name: transcriptData.exams.exam_name,
        academic_year: transcriptData.exams.academic_year,
        term: transcriptData.exams.term,
        exam_start_date: transcriptData.exams.start_date,
        exam_end_date: transcriptData.exams.end_date,
        student_name: transcriptData.profiles.full_name,
        admission_number: transcriptData.profiles.admission_number,
        class_name: transcriptData.profiles.form_class,
        total_score: transcriptData.total_score,
        average_score: transcriptData.average_score,
        overall_grade: transcriptData.overall_grade,
        class_position: transcriptData.class_position,
        admin_remarks: transcriptData.admin_remarks,
        published_at: transcriptData.published_at,
        items: itemsData || [],
      };

      setTranscript(fullTranscript);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      alert("Failed to load transcript");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPDF() {
    // Trigger browser print dialog which can save as PDF
    window.print();
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!transcript) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
      {/* Mobile & Desktop Container */}
      <div className="min-h-screen flex flex-col">
        {/* Header - Fixed on mobile */}
        <div className="sticky top-0 z-10 bg-card border-b border-border/50 px-4 py-3 print:hidden">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Official Transcript</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPDF}
                className="hidden sm:flex"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                className="hidden sm:flex"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Transcript Document */}
        <div className="flex-1 p-4 sm:p-8">
          <div className="max-w-4xl mx-auto bg-white text-black shadow-2xl rounded-lg overflow-hidden print:shadow-none print:rounded-none">
            <div className="p-6 sm:p-8 lg:p-12">
              {/* Official Header */}
              <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lock className="w-6 h-6 text-green-600" />
                  <span className="text-sm font-semibold text-green-600 uppercase tracking-wide">
                    Official Document
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                  Academic Transcript
                </h1>
                <p className="text-lg sm:text-xl text-gray-700 font-semibold">
                  {transcript.exam_name}
                </p>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  {transcript.term} • Academic Year {transcript.academic_year}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  Issued: {new Date(transcript.published_at).toLocaleDateString()}
                </p>
              </div>

              {/* Student Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 sm:p-6 rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Student Name</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-900">
                    {transcript.student_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Admission Number</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-900 font-mono">
                    {transcript.admission_number}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Class</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-900">
                    {transcript.class_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Examination Period</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-900">
                    {new Date(transcript.exam_start_date).toLocaleDateString()} -{" "}
                    {new Date(transcript.exam_end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Results - Desktop Table */}
              <div className="hidden sm:block mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Subject Results
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                          Subject
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-900">
                          Score
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-900">
                          Max
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-900">
                          Grade
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transcript.items.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                            {item.subject_name}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-900">
                            {item.score}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm text-gray-700">
                            {item.max_score}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-base font-bold text-gray-900">
                            {item.grade}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">
                            {item.teacher_remarks || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Results - Mobile Cards */}
              <div className="sm:hidden mb-8 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Subject Results
                </h3>
                {transcript.items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{item.subject_name}</h4>
                      <span className="text-2xl font-bold text-gray-900">{item.grade}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      <div>
                        <span className="text-gray-600">Score: </span>
                        <span className="font-semibold text-gray-900">
                          {item.score}/{item.max_score}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Percentage: </span>
                        <span className="font-semibold text-gray-900">
                          {((item.score / item.max_score) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {item.teacher_remarks && (
                      <p className="text-sm text-gray-700 italic">
                        "{item.teacher_remarks}"
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-lg border border-blue-200">
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Score</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {transcript.total_score}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Average</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {transcript.average_score.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Overall Grade</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-indigo-600">
                    {transcript.overall_grade}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Class Position</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center justify-center gap-1">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                    {transcript.class_position}
                  </p>
                </div>
              </div>

              {/* Admin Remarks */}
              {transcript.admin_remarks && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 sm:p-6 rounded-r-lg mb-8">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-600" />
                    Administrator's Remarks
                  </h3>
                  <p className="text-sm sm:text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {transcript.admin_remarks}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-xs sm:text-sm text-gray-500 pt-6 border-t border-gray-200">
                <p>This is an official academic document issued by the institution.</p>
                <p className="mt-1">
                  Document ID: {transcript.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Action Buttons */}
        <div className="sticky bottom-0 sm:hidden bg-card border-t border-border/50 p-4 print:hidden">
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadPDF}
              className="flex-1 bg-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex-1"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
