'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  FileText, Clock, CheckCircle2, AlertCircle, ArrowLeft,
  Download, Upload, Image, Camera, Trash2, Loader2, Send,
  XCircle, Eye, Star, TrendingUp, TrendingDown, BookOpen,
  ChevronRight, MessageSquare, Flag, Pencil, Trophy, Calendar, ArrowRight, ChevronLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PremiumWorksheetPlayer from './PremiumWorksheetPlayer';
import { generateAssignmentPDFReport } from '@/lib/reports/assignment-report-generator';

const supabase = createClient();

interface Assignment {
  id: string;
  title: string;
  instructions?: string;
  due_date: string;
  submission_type: 'WORKSHEET' | 'PHOTO' | 'MIXED' | 'INTERACTIVE';
  type: string;
  allow_late_submission: boolean;
  total_marks: number;
  estimated_minutes?: number;
  classes?: { name: string };
  subjects?: { name: string };
  assignment_files?: AssignmentFile[];
  student_submission?: StudentSubmission;
}

interface AssignmentFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: 'QUESTION_PAPER' | 'WORKSHEET' | 'REFERENCE' | 'OTHER';
}

interface StudentSubmission {
  id: string;
  assignment_id?: string;
  status: string;
  submitted_at: string;
  score?: number; // Instant score from submission record
  marked_file_url?: string;
  is_late?: boolean;
  submission_files?: { id: string; file_name: string; file_url: string; file_type: string }[];
  submission_feedback?: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    improvement_suggestions?: string[];
    is_returned: boolean
  }[];
  submission_annotations?: { annotation_data: any[] }[];
  strengths?: string[];
  weaknesses?: string[];
  improvement_suggestions?: string[];
  teacher_remarks?: string;
}

interface Props {
  studentId: string;
}

// ─── ASSIGNMENT DETAIL + SUBMISSION SCREEN ─────────────────────────
function AssignmentDetail({ assignment, studentId, onBack }: { assignment: Assignment; studentId: string; onBack: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [worksheetFile, setWorksheetFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<StudentSubmission | null>(assignment.student_submission || null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [showWorksheetPlayer, setShowWorksheetPlayer] = useState(false);

  const isOverdue = new Date(assignment.due_date) < new Date();
  const canSubmit = !submission && (!isOverdue || assignment.allow_late_submission);
  const isReturned = submission?.status === 'RETURNED';
  const feedback = submission?.submission_feedback?.[0];

  function addPhotos(files: FileList) {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    setPhotoFiles(prev => [...prev, ...imgs].slice(0, 10));
  }

  async function handleSubmit() {
    if (submitting) return;
    if (assignment.submission_type === 'WORKSHEET' && !worksheetFile) {
      toast.error('Please upload a worksheet file');
      return;
    }
    if (assignment.submission_type === 'PHOTO' && photoFiles.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }

    setSubmitting(true);
    try {
      // Create submission record
      const { data: sub, error: subErr } = await supabase
        .from('student_submissions')
        .insert({
          assignment_id: assignment.id,
          student_id: studentId,
          status: isOverdue ? 'LATE' : 'SUBMITTED',
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (subErr) throw subErr;

      const subId = sub.id;
      const uploadedFiles = [];

      // Upload worksheet
      if (worksheetFile) {
        const ext = worksheetFile.name.split('.').pop();
        const path = `submissions/${studentId}/${assignment.id}/worksheet_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('enterprise-assignments').upload(path, worksheetFile);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('enterprise-assignments').getPublicUrl(path);
          uploadedFiles.push({ submission_id: subId, file_name: worksheetFile.name, file_url: publicUrl, file_type: 'WORKSHEET', file_size: worksheetFile.size });
        }
      }

      // Upload photos
      for (const photo of photoFiles) {
        const ext = photo.name.split('.').pop();
        const path = `submissions/${studentId}/${assignment.id}/photo_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('enterprise-assignments').upload(path, photo);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('enterprise-assignments').getPublicUrl(path);
          uploadedFiles.push({ submission_id: subId, file_name: photo.name, file_url: publicUrl, file_type: 'PHOTO', file_size: photo.size });
        }
      }

      if (uploadedFiles.length > 0) {
        await supabase.from('submission_files').insert(uploadedFiles);
      }

      toast.success('✅ Assignment submitted successfully!');
      // Reload submission
      const { data: fresh } = await supabase
        .from('student_submissions')
        .select('*, submission_files(*), submission_feedback(*)')
        .eq('id', subId)
        .single();
      if (fresh) setSubmission(fresh);
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function reportIssue() {
    if (!reportReason.trim() || !submission) return;
    setReportSending(true);
    try {
      await supabase.from('notifications').insert({
        type: 'warning',
        title: 'Marking Issue Reported',
        message: `Student reported issue with "${assignment.title}" submission: ${reportReason}`,
        target_user_id: null, // teacher will see it
        audience: 'teacher',
        created_by: studentId,
      });
      toast.success('Issue reported to your teacher');
      setReportModalOpen(false);
      setReportReason('');
    } catch {
      toast.error('Failed to send report');
    } finally {
      setReportSending(false);
    }
  }

  const fileTypeColors: Record<string, string> = {
    QUESTION_PAPER: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    WORKSHEET: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    REFERENCE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    OTHER: 'bg-slate-700 text-slate-400 border-slate-600',
  };

  return (
    <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Assignments
      </button>

      {/* Assignment Header */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-3">
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold">{assignment.subjects?.name}</span>
          <span className="px-2.5 py-1 bg-slate-700/80 text-slate-400 rounded-full text-xs">{assignment.submission_type} submission</span>
          {assignment.estimated_minutes && (
            <span className="px-2.5 py-1 bg-slate-700/80 text-slate-400 rounded-full text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" /> ~{assignment.estimated_minutes} min
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-foreground">{assignment.title}</h2>
        <p className="text-muted-foreground text-sm">
          {assignment.classes?.name}
        </p>
        <div className={cn(
          "flex items-center gap-2 text-sm font-medium",
          isOverdue ? 'text-red-400' : 'text-muted-foreground'
        )}>
          <Clock className="w-4 h-4" />
          Due {format(new Date(assignment.due_date), 'EEEE, MMMM d, yyyy')} at {format(new Date(assignment.due_date), 'h:mm a')}
          {isOverdue && <span className="text-red-400 font-bold ml-1">— OVERDUE</span>}
        </div>
        {(assignment.type === 'ONLINE_AUTO_GRADED' || assignment.submission_type === 'INTERACTIVE') && !submission && (
           <div className="pt-6">
              <button
                onClick={() => setShowWorksheetPlayer(true)}
                className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98]"
              >
                <Pencil className="w-4 h-4" />
                Start Interactive Worksheet
              </button>
           </div>
        )}

        {assignment.instructions && (
          <div className="pt-3 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Instructions</p>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{assignment.instructions}</p>
          </div>
        )}
      </div>

      {showWorksheetPlayer && (
        <div className="fixed inset-0 w-full h-[100dvh] z-[100] bg-[#0a0c10] flex flex-col">
          <PremiumWorksheetPlayer
            assignmentId={assignment.id}
            studentId={studentId}
            submissionId={submission?.id}
            onClose={() => setShowWorksheetPlayer(false)}
            onSubmit={() => {
               setShowWorksheetPlayer(false);
               onBack(); // Refresh list
            }}
            reviewMode={submission?.status === 'RETURNED' || submission?.status === 'MARKED' || submission?.status === 'SUBMITTED' || submission?.status === 'LATE'}
          />
        </div>
      )}

      {/* Resource Files */}
      {assignment.assignment_files && assignment.assignment_files.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Assignment Resources
          </h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {assignment.assignment_files.map(file => (
              <a
                key={file.id}
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all hover:opacity-80", fileTypeColors[file.file_type])}
              >
                <FileText className="w-5 h-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.file_name}</p>
                  <p className="text-xs opacity-70">{file.file_type.replace('_', ' ')}</p>
                </div>
                <Download className="w-4 h-4 shrink-0 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── SUBMISSION STATUS (already submitted) ── */}
      {submission && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Your Submission
            </h3>
            <span className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold",
              isReturned ? 'bg-emerald-500/10 text-emerald-400' :
              submission.status === 'MARKED' ? 'bg-amber-500/10 text-amber-400' :
              submission.status === 'LATE' ? 'bg-red-500/10 text-red-400' :
              'bg-indigo-500/10 text-indigo-400'
            )}>{submission.status}</span>
          </div>

          <p className="text-muted-foreground text-sm">
            Submitted {format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}
          </p>

          {/* Submitted files */}
          {submission.submission_files && submission.submission_files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted Files</p>
              {submission.submission_files.map(f => (
                <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-card hover:bg-muted rounded-xl border border-border/50 transition-colors">
                  {f.file_type === 'PHOTO' ? <Image className="w-4 h-4 text-amber-400" /> : <FileText className="w-4 h-4 text-indigo-400" />}
                  <span className="text-sm text-foreground">{f.file_name}</span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                </a>
              ))}
            </div>
          )}

          {/* Feedback (when returned) */}
          {isReturned && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">Teacher Feedback</h4>
                <div className="flex items-center gap-3">
                  {(feedback?.score ?? submission.score) != null && (
                    <div className="text-right">
                      <div className="text-3xl font-black text-amber-400">{feedback?.score ?? submission.score}</div>
                      <div className="text-xs text-muted-foreground">/ {assignment.total_marks}</div>
                    </div>
                  )}
                  {(feedback?.score ?? submission.score) != null && (
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold border-2",
                      (feedback?.score ?? submission.score)! / assignment.total_marks >= 0.7 ? 'border-emerald-400 text-emerald-400' :
                      (feedback?.score ?? submission.score)! / assignment.total_marks >= 0.5 ? 'border-amber-400 text-amber-400' :
                      'border-red-400 text-red-400'
                    )}>
                      {Math.round(((feedback?.score ?? submission.score)! / assignment.total_marks) * 100)}%
                    </div>
                  )}
                </div>
              </div>

              {((feedback?.strengths || submission.strengths) && (feedback?.strengths || submission.strengths)!.length > 0) && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Strengths
                  </p>
                  <div className="space-y-1.5">
                    {(feedback?.strengths || submission.strengths)!.map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-foreground">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {((feedback?.weaknesses || submission.weaknesses) && (feedback?.weaknesses || submission.weaknesses)!.length > 0) && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" /> Areas for Improvement
                  </p>
                  <div className="space-y-1.5">
                    {(feedback?.weaknesses || submission.weaknesses)!.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="text-foreground">{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(feedback?.improvement_suggestions || submission.improvement_suggestions) && (feedback?.improvement_suggestions || submission.improvement_suggestions)!.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Tactical Recommendations
                  </p>
                  <div className="space-y-1.5">
                    {(feedback?.improvement_suggestions || submission.improvement_suggestions)!.map((imp: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Star className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span className="text-foreground">{imp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {submission.teacher_remarks && (
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                   <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Executive Summary</p>
                   <p className="text-sm italic text-slate-300 leading-relaxed">"{submission.teacher_remarks}"</p>
                </div>
              )}

              {/* Strategic Evaluation Output (Marked Script) */}
              {(assignment.type === 'ONLINE_AUTO_GRADED' || assignment.submission_type === 'INTERACTIVE' || assignment.type === 'ONLINE_WORKSHEET') && isReturned && (
                <button
                  onClick={() => setShowWorksheetPlayer(true)}
                  className="w-full flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl hover:bg-indigo-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-xl group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Graded Interactive Script</p>
                      <p className="text-sm font-bold text-white">Review Annotated Worksheet</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-indigo-400" />
                </button>
              )}

              {submission.marked_file_url && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-indigo-300 uppercase tracking-tighter">Annotated Marking Script</p>
                      <p className="text-[10px] text-indigo-400/60 font-bold uppercase tracking-widest">Enterprise Digital Assessment Final</p>
                    </div>
                  </div>
                   <button
                    onClick={() => generateAssignmentPDFReport(submission.id)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg group-hover:scale-105"
                  >
                    <Download className="w-4 h-4" />
                    Secure Download
                  </button>
                </div>
              )}

              {submission.status === 'RETURNED' && (assignment.type === 'ONLINE_AUTO_GRADED' || assignment.submission_type === 'INTERACTIVE' || assignment.type === 'ONLINE_WORKSHEET') && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <Star className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-emerald-300 uppercase tracking-tighter">Evaluation Report</p>
                      <p className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-widest">Generate Professional PDF Script</p>
                    </div>
                  </div>
                  <button
                    onClick={() => generateAssignmentPDFReport(submission.id)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg group-hover:scale-105"
                  >
                    <Download className="w-4 h-4" />
                    Export Report
                  </button>
                </div>
              )}

              {/* Report Issue */}
              <button
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                Report a marking issue
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SUBMISSION FORM (not yet submitted) ── */}
      {canSubmit && assignment.type !== 'ONLINE_AUTO_GRADED' && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Submit Your Work</h3>

          {/* Worksheet upload */}
          {(assignment.submission_type === 'WORKSHEET' || assignment.submission_type === 'MIXED') && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Worksheet Upload (PDF, DOCX)
              </label>
              {worksheetFile ? (
                <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm text-foreground flex-1">{worksheetFile.name}</span>
                  <button onClick={() => setWorksheetFile(null)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload worksheet</p>
                  <p className="text-xs text-muted-foreground/60">PDF, DOCX, or images</p>
                  <input type="file" className="hidden" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" onChange={e => e.target.files?.[0] && setWorksheetFile(e.target.files[0])} />
                </label>
              )}
            </div>
          )}

          {/* Photo upload */}
          {(assignment.submission_type === 'PHOTO' || assignment.submission_type === 'MIXED') && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Photo Uploads (up to 10)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photoFiles.map((photo, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={photo.name}
                      className="w-full h-28 object-cover rounded-xl border border-border"
                    />
                    <button
                      onClick={() => setPhotoFiles(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photoFiles.length < 10 && (
                  <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-amber-500 hover:bg-amber-500/5 transition-all">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-1">Add photo</p>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={e => e.target.files && addPhotos(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {isOverdue && assignment.allow_late_submission && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              This is a late submission. Your teacher may apply a late penalty.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {submitting ? 'Submitting...' : 'Submit Assignment'}
          </button>
        </div>
      )}

      {/* Not late-allowed and overdue */}
      {!submission && isOverdue && !assignment.allow_late_submission && (
        <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-red-400 font-semibold">Submission Closed</p>
          <p className="text-red-400/70 text-sm">The due date has passed and late submissions are not allowed for this assignment.</p>
        </div>
      )}

      {/* Report Issue Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-foreground">Report Marking Issue</h3>
            <div className="space-y-2">
              {['Incorrect marking', 'Missing marks', 'Clarification request', 'Other'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={cn("w-full text-left px-4 py-3 rounded-xl border transition-all text-sm", reportReason === reason ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-border text-foreground hover:border-indigo-500/50')}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setReportModalOpen(false)} className="flex-1 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={reportIssue}
                disabled={reportSending || !reportReason.trim()}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {reportSending ? 'Sending...' : 'Send Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── X helper used below ──────────────────────────────────────────
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── MAIN STUDENT ASSIGNMENTS VIEW ──────────────────────────────────
export default function EnterpriseStudentAssignments({ studentId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SUBMITTED' | 'MARKED'>('ALL');
  const [showMarkingReview, setShowMarkingReview] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<StudentSubmission | null>(null);


  useEffect(() => { fetchAssignments(); }, [studentId]);

  async function fetchAssignments() {
    setLoading(true);
    try {
      // Get assignments from recipients table (targeted delivery)
      const { data: recipientRows } = await supabase
        .from('assignment_recipients')
        .select('assignment_id')
        .eq('student_id', studentId);

      const recipientIds = recipientRows?.map((r: any) => r.assignment_id) || [];

      // Also get class-wide assignments (Check both legacy student_classes and new student_subject_enrollments)
      const { data: classRows } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('student_id', studentId);

      const { data: enrollmentRows } = await supabase
        .from('student_subject_enrollments')
        .select('class_id')
        .eq('student_id', studentId);

      const legacyClassIds = classRows?.map((c: any) => c.class_id) || [];
      const enrollmentClassIds = enrollmentRows?.map((c: any) => c.class_id) || [];

      const classIds = Array.from(new Set([...legacyClassIds, ...enrollmentClassIds]));

      if (recipientIds.length === 0 && classIds.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('assignments')
        .select(`
          *,
          classes(name),
          subjects(name),
          assignment_files(id, file_name, file_url, file_type)
        `)
        .eq('status', 'PUBLISHED')
        .order('due_date', { ascending: true });

      if (recipientIds.length > 0 && classIds.length > 0) {
        query = query.or(`id.in.(${recipientIds.join(',')}),class_id.in.(${classIds.join(',')})`);
      } else if (recipientIds.length > 0) {
        query = query.in('id', recipientIds);
      } else if (classIds.length > 0) {
        query = query.in('class_id', classIds);
      }

      const { data: rawAssignments } = await query;
      if (!rawAssignments || rawAssignments.length === 0) {
        setAssignments([]);
        return;
      }

      // Fetch student's existing submissions
      const { data: submissions } = await supabase
        .from('student_submissions')
        .select('*, submission_files(*), submission_feedback(*)')
        .eq('student_id', studentId)
        .in('assignment_id', rawAssignments.map((a: any) => a.id));

      const subMap = new Map(submissions?.map((s: any) => [s.assignment_id, s]) || []);

      const enriched: Assignment[] = rawAssignments.map((a: any) => {
        const sub = subMap.get(a.id);
        return {
          ...a,
          student_submission: sub ? { ...sub, assignment_id: a.id } : null,
        };
      });

      setAssignments(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (selectedAssignment) {
    return (
      <AssignmentDetail
        assignment={selectedAssignment}
        studentId={studentId}
        onBack={() => { setSelectedAssignment(null); fetchAssignments(); }}
      />
    );
  }

  if (showMarkingReview && viewingSubmission && viewingSubmission.assignment_id) {
    const assignment = assignments.find(a => a.id === viewingSubmission.assignment_id);
    if (!assignment) {
      // Handle case where assignment is not found (shouldn't happen if data is consistent)
      setShowMarkingReview(false);
      setViewingSubmission(null);
      return null;
    }
    return (
      <div className="fixed inset-0 w-full h-[100dvh] z-[100] bg-[#0a0c10] flex flex-col">
        <PremiumWorksheetPlayer
          assignmentId={assignment.id}
          studentId={studentId}
          submissionId={viewingSubmission.id}
          onClose={() => {
            setShowMarkingReview(false);
            setViewingSubmission(null);
          }}
          onSubmit={() => {
            setShowMarkingReview(false);
            setViewingSubmission(null);
            fetchAssignments(); // Refresh list
          }}
          reviewMode={true}
        />
      </div>
    );
  }

  const filtered = assignments.filter(a => {
    const sub = a.student_submission;
    const isSubmitted = !!sub;
    const isMarked = sub?.status === 'RETURNED' || sub?.status === 'MARKED';
    if (filter === 'PENDING') return !isSubmitted;
    if (filter === 'SUBMITTED') return isSubmitted && !isMarked;
    if (filter === 'MARKED') return isMarked;
    return true;
  });

  const AssignmentCard = ({ assignment }: { assignment: Assignment }) => {
    const subData = assignment.student_submission ? [assignment.student_submission] : [];
    const submission = subData?.[0];
    const isMarked = submission?.status === 'RETURNED' || submission?.status === 'MARKED';
    const isLate = submission?.is_late || (assignment.due_date && new Date() > new Date(assignment.due_date) && !submission);

    return (
      <div key={assignment.id} className="group relative">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 shadow-xl">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold group-hover:text-indigo-400 transition-colors">{assignment.title}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">{assignment.subjects?.name} • {assignment.classes?.name}</p>
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                isMarked ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                submission ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                isLate ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                "bg-slate-800 text-slate-500 border-slate-700"
              )}>
                {isMarked ? "Marked" : submission ? "Submitted" : isLate ? "Late" : "Pending"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-800/50">
              <div>
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Due Date</p>
                <div className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold">{format(new Date(assignment.due_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
              {isMarked && (submission?.score != null) && (
                <div>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Your Score</p>
                  <div className="flex items-center gap-2 text-emerald-400 font-black">
                    <Trophy className="w-4 h-4" />
                    <span className="text-sm">{submission.score} / {assignment.total_marks || 100}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {isMarked && (assignment.type === 'ONLINE_AUTO_GRADED' || assignment.submission_type === 'INTERACTIVE' || assignment.type === 'ONLINE_WORKSHEET') && (
                <button
                  onClick={() => {
                     setViewingSubmission(submission);
                     setShowMarkingReview(true);
                  }}
                  className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" /> Review Annotated Worksheet
                </button>
              )}
              <button
                onClick={() => setSelectedAssignment(assignment)}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {submission ? "View Submission" : "Open Assignment"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Assignments</h2>
          <p className="text-muted-foreground text-sm">{assignments.filter(a => !a.student_submission).length} pending</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['ALL', 'PENDING', 'SUBMITTED', 'MARKED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No assignments in this category</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(assignment => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}
    </div>
  );
}
