'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  X, ChevronRight, ChevronLeft, Upload, FileText, Calendar,
  Users, BookOpen, Clock, AlertCircle, Loader2, Check, Image,
  Layers, Target, Plus, Trash2, Search, UserCheck, Group, Pencil

} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PremiumWorksheetBuilder from './PremiumWorksheetBuilder';

const supabase = createClient();

interface TeacherClass {
  id: string;
  name: string;
  form_level: string;
  subjects: string[];
}

interface SubjectObj {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
  admission_number?: string;
}

interface AssignmentFile {
  file: File;
  fileType: 'QUESTION_PAPER' | 'WORKSHEET' | 'REFERENCE' | 'OTHER';
  label: string;
}

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const SUBMISSION_TYPES = [
  { value: 'WORKSHEET', label: 'Worksheet Submission', desc: 'Students upload completed worksheet (PDF, DOCX)', icon: FileText, color: 'indigo' },
  { value: 'PHOTO', label: 'Photo Submission', desc: 'Students photograph handwritten work and upload images', icon: Image, color: 'amber' },
  { value: 'MIXED', label: 'Mixed Submission', desc: 'Students may submit worksheet or photos — or both', icon: Layers, color: 'emerald' },
  { value: 'INTERACTIVE', label: 'Online Worksheet', desc: 'Teachers build premium multi-page worksheets for students to complete online', icon: Target, color: 'indigo' },
];

const FILE_TYPE_OPTIONS = [
  { value: 'QUESTION_PAPER', label: 'Question Paper' },
  { value: 'WORKSHEET', label: 'Worksheet' },
  { value: 'REFERENCE', label: 'Reference Material' },
  { value: 'OTHER', label: 'Supporting File' },
];

export default function EnterpriseAssignmentCreator({ userId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Teacher data
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [subjects, setSubjects] = useState<SubjectObj[]>([]);
  const [tuitionEvents, setTuitionEvents] = useState<{ id: string; event_name: string }[]>([]);
  const [eligibleStudents, setEligibleStudents] = useState<Student[]>([]);
  const [studentGroups, setStudentGroups] = useState<{ id: string; group_name: string; member_count: number }[]>([]);

  // Step 1 — Basics
  const [title, setTitle] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [allowLate, setAllowLate] = useState(true);
  const [submissionType, setSubmissionType] = useState<'WORKSHEET' | 'PHOTO' | 'MIXED' | 'INTERACTIVE'>('WORKSHEET');
  const [showWorksheetBuilder, setShowWorksheetBuilder] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [worksheetPagesCount, setWorksheetPagesCount] = useState(0);

  // Step 2 — Files
  const [filesToUpload, setFilesToUpload] = useState<AssignmentFile[]>([]);

  // Step 3 — Visibility
  const [visibilityType, setVisibilityType] = useState<'CLASS' | 'SPECIFIC' | 'GROUP'>('CLASS');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const availableSubjects = useCallback(() => {
    if (!selectedClassId) return [];
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return [];
    return subjects.filter(s => cls.subjects.includes(s.name) || cls.subjects.includes(s.id));
  }, [selectedClassId, classes, subjects]);

  useEffect(() => {
    fetchTeacherData();
  }, [userId]);

  useEffect(() => {
    if (selectedClassId && selectedSubjectId) {
      fetchEligibleStudents();
      fetchStudentGroups();
    }
  }, [selectedClassId, selectedSubjectId]);

  async function fetchTeacherData() {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
      const isAdmin = profile?.role === 'admin';

      if (isAdmin) {
        const [{ data: allClasses }, { data: allSubjects }] = await Promise.all([
          supabase.from('classes').select('id, name, form_level'),
          supabase.from('subjects').select('id, name'),
        ]);
        if (allClasses && allSubjects) {
          const allSubjectNames = allSubjects.map((s: any) => s.name);
          setClasses(allClasses.map((c: any) => ({ ...c, subjects: allSubjectNames })));
          setSubjects(allSubjects);
        }
      } else {
        const { data: teacherClasses } = await supabase
          .from('teacher_classes')
          .select('class_id, subjects, classes!inner(id, name, form_level)')
          .eq('teacher_id', userId);

        if (teacherClasses) {
          const processed = teacherClasses.map((tc: any) => ({
            id: tc.class_id,
            name: tc.classes.name,
            form_level: tc.classes.form_level,
            subjects: tc.subjects || [],
          }));
          setClasses(processed);

          const identifiers = Array.from(new Set(processed.flatMap((c: any) => c.subjects)));
          if (identifiers.length > 0) {
            const { data: subByName } = await supabase.from('subjects').select('id, name').in('name', identifiers as string[]);
            const { data: subById } = await supabase.from('subjects').select('id, name').in('id', (identifiers as string[]).filter((i: any) => i.length === 36));
            const merged = [...(subByName || []), ...(subById || [])];
            const unique = Array.from(new Map(merged.map((s: any) => [s.id, s])).values());
            setSubjects(unique);
          }
        }
      }

      // Fetch tuition events
      const { data: events } = await supabase
        .from('tuition_events')
        .select('id, event_name')
        .eq('status', 'active')
        .order('start_date', { ascending: false });
      if (events) setTuitionEvents(events);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEligibleStudents() {
    try {
      const subjectName = subjects.find((s: any) => s.id === selectedSubjectId)?.name;
      const className = classes.find((c: any) => c.id === selectedClassId)?.name;

      if (!subjectName || !selectedClassId) return;

      // 1. Try student_subject_enrollments (the new source of truth)
      const { data: enrolled } = await supabase
        .from('student_subject_enrollments')
        .select('student_id, profiles!inner(id, full_name, admission_number)')
        .eq('class_id', selectedClassId)
        .eq('subject_id', selectedSubjectId);

      if (enrolled && enrolled.length > 0) {
        setEligibleStudents(enrolled.map((e: any) => ({
          id: e.profiles.id,
          full_name: e.profiles.full_name,
          admission_number: e.profiles.admission_number,
        })));
        return;
      }

      // 2. Fallback: Search profiles and student_subjects
      // We look for students who are either in the class via student_classes OR form_class text
      // And who have the subject in their JSONB list OR student_subjects table
      
      const { data: classStudentIds } = await supabase
        .from('student_classes')
        .select('student_id')
        .eq('class_id', selectedClassId);
      
      const studentIdList = classStudentIds?.map((s: any) => s.student_id) || [];

      let query = supabase
        .from('profiles')
        .select('id, full_name, admission_number, subjects, form_class')
        .eq('role', 'student');

      // Filter by class (either UUID list or Name text)
      if (studentIdList.length > 0) {
        if (className) {
          query = query.or(`id.in.(${studentIdList.join(',')}),form_class.eq."${className}"`);
        } else {
          query = query.in('id', studentIdList);
        }
      } else if (className) {
        query = query.eq('form_class', className);
      }

      const { data: allClassStudents } = await query;

      if (allClassStudents) {
        const filtered = allClassStudents.filter((s: any) => {
          // Check JSONB subjects
          const jsonSubjects = Array.isArray(s.subjects) ? s.subjects : [];
          if (jsonSubjects.some((sj: any) => 
            (typeof sj === 'string' && sj === subjectName) || 
            (sj?.name === subjectName) || 
            (sj?.id === selectedSubjectId)
          )) return true;
          return false;
        });

        if (filtered.length > 0) {
          setEligibleStudents(filtered.map((s: any) => ({
            id: s.id,
            full_name: s.full_name,
            admission_number: s.admission_number,
          })));
          return;
        }

        // 3. Final Fallback: Just return all students in class if no subject filtering possible
        setEligibleStudents(allClassStudents.map((s: any) => ({
          id: s.id,
          full_name: s.full_name,
          admission_number: s.admission_number,
        })));
      }
    } catch (err) {
      console.error('Error fetching eligible students:', err);
    }
  }

  async function fetchStudentGroups() {
    try {
      const { data: groups } = await supabase
        .from('student_groups')
        .select('id, group_name, group_members(count)')
        .eq('class_id', selectedClassId)
        .eq('subject_id', selectedSubjectId)
        .eq('teacher_id', userId);

      if (groups) {
        setStudentGroups(groups.map((g: any) => ({
          id: g.id,
          group_name: g.group_name,
          member_count: g.group_members?.[0]?.count || 0,
        })));
      }
    } catch (err) {
      console.error(err);
    }
  }

  function addFile(file: File, fileType: AssignmentFile['fileType']) {
    setFilesToUpload(prev => [...prev, { file, fileType, label: file.name }]);
  }

  function removeFile(idx: number) {
    setFilesToUpload(prev => prev.filter((_, i) => i !== idx));
  }

  function changeFileType(idx: number, fileType: AssignmentFile['fileType']) {
    setFilesToUpload(prev => prev.map((f, i) => i === idx ? { ...f, fileType } : f));
  }

  function validateStep(s: number): boolean {
    if (s === 1) {
      if (!title.trim()) { setError('Assignment title is required'); return false; }
      if (!selectedClassId) { setError('Please select a class'); return false; }
      if (!selectedSubjectId) { setError('Please select a subject'); return false; }
      if (!dueDate) { setError('Please set a due date'); return false; }
    }
    setError('');
    return true;
  }

  function getRecipientSummary(): string {
    if (visibilityType === 'CLASS') return `${eligibleStudents.length} students (Entire Class)`;
    if (visibilityType === 'SPECIFIC') return `${selectedStudents.length} selected students`;
    const grp = studentGroups.find(g => g.id === selectedGroupId);
    return grp ? `${grp.member_count} students · Group: ${grp.group_name}` : 'Select a group';
  }

  async function handleSubmit(publishNow: boolean) {
    if (submitting) return;
    
    // If it's an interactive worksheet and we haven't created the assignment ID yet, 
    // we need to save it as a draft first before opening the builder.
    // However, the builder is usually opened in Step 2.
    // Let's refine the logic: Step 2 for INTERACTIVE will be the Builder.
    
    setSubmitting(true);
    setError('');

    try {
      // 1. Create or Update assignment record
      const payload = {
        title,
        teacher_id: userId,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        tuition_event_id: selectedEventId || null,
        description: instructions,
        instructions,
        estimated_minutes: estimatedMinutes,
        due_date: `${dueDate}T${dueTime}:00`,
        allow_late_submission: allowLate,
        submission_type: submissionType,
        visibility_type: visibilityType,
        type: submissionType === 'INTERACTIVE' ? 'ONLINE_AUTO_GRADED' : 'OFFLINE_DOCUMENT_BASED',
        total_marks: 100,
        status: publishNow ? 'PUBLISHED' : 'DRAFT',
        published_at: publishNow ? new Date().toISOString() : null,
      };

      let currentAssignmentId = assignmentId;

      if (currentAssignmentId) {
        await supabase.from('assignments').update(payload).eq('id', currentAssignmentId);
      } else {
        const { data, error: aErr } = await supabase
          .from('assignments')
          .insert(payload)
          .select()
          .single();
        if (aErr) throw aErr;
        currentAssignmentId = data.id;
        setAssignmentId(currentAssignmentId);
      }

      // 2. Upload files to Supabase Storage and record them
      for (const af of filesToUpload) {
        const ext = af.file.name.split('.').pop();
        // Use currentAssignmentId (not stale state) for the path
        const path = `${currentAssignmentId}/${af.fileType}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('enterprise-assignments')
          .upload(path, af.file);
        if (upErr) { console.warn('File upload failed:', upErr.message); continue; }
        const { data: { publicUrl } } = supabase.storage.from('enterprise-assignments').getPublicUrl(path);
        await supabase.from('assignment_files').insert({
          assignment_id: currentAssignmentId,  // Fixed: was using stale `assignmentId` state
          file_name: af.file.name,
          file_url: publicUrl,
          file_type: af.fileType,
          file_size: af.file.size,
        });
      }

      // 3. Create assignment recipients based on visibility
      if (publishNow) {
        let recipientIds: string[] = [];
        if (visibilityType === 'CLASS') {
          recipientIds = eligibleStudents.map(s => s.id);
        } else if (visibilityType === 'SPECIFIC') {
          recipientIds = selectedStudents;
        } else if (visibilityType === 'GROUP' && selectedGroupId) {
          const { data: members } = await supabase.from('group_members').select('student_id').eq('group_id', selectedGroupId);
          recipientIds = members?.map((m: any) => m.student_id) || [];
        }

        if (recipientIds.length > 0) {
          // Fixed: was using stale `assignmentId` state instead of `currentAssignmentId` local variable
          await supabase.from('assignment_recipients').insert(
            recipientIds.map(sid => ({ assignment_id: currentAssignmentId, student_id: sid }))
          );
        }

        // Notify students
        const className = classes.find(c => c.id === selectedClassId)?.name;
        const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name;
        await supabase.from('notifications').insert({
          type: 'info',
          title: 'New Assignment',
          message: `${subjectName} assignment for ${className}: ${title} — Due ${new Date(dueDate).toLocaleDateString()}`,
          created_by: userId,
          target_class_id: selectedClassId,
          audience: 'student',
        });
      }

      toast.success(publishNow ? '🎉 Assignment published successfully!' : 'Assignment saved as draft');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered students for search
  const filteredStudents = eligibleStudents.filter(s =>
    s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-white/70">Loading teacher data...</p>
        </div>
      </div>
    );
  }

  const STEPS = ['Basics', 'Resources', 'Visibility', 'Review'];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Create Assignment</h2>
            <p className="text-slate-400 text-sm mt-0.5">Step {step} of 4 — {STEPS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex px-6 py-3 gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col gap-1">
              <div className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i + 1 < step ? 'bg-emerald-500' : i + 1 === step ? 'bg-indigo-500' : 'bg-slate-700'
              )} />
              <span className={cn("text-[10px] font-medium hidden sm:block", i + 1 === step ? 'text-indigo-400' : 'text-slate-600')}>{s}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">

          {/* ── STEP 1: BASICS ── */}
          {step === 1 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">

              {/* Submission Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Submission Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SUBMISSION_TYPES.map(({ value, label, desc, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSubmissionType(value as any)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        submissionType === value
                          ? `bg-${color}-500/10 border-${color}-500`
                          : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <Icon className={cn("w-5 h-5 mb-2", submissionType === value ? `text-${color}-400` : 'text-slate-500')} />
                      <p className="font-semibold text-white text-sm">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Assignment Title *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Algebra Practice Set 3"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Class + Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Class *</label>
                  <select
                    value={selectedClassId}
                    onChange={e => { setSelectedClassId(e.target.value); setSelectedSubjectId(''); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  >
                    <option value="">Select class...</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Subject *</label>
                  <select
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
                    disabled={!selectedClassId}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none disabled:opacity-50"
                  >
                    <option value="">Select subject...</option>
                    {availableSubjects().map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Tuition Event */}
              {tuitionEvents.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Link to Tuition Event (Optional)</label>
                  <select
                    value={selectedEventId}
                    onChange={e => setSelectedEventId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  >
                    <option value="">No event link</option>
                    {tuitionEvents.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.event_name}</option>)}
                  </select>
                </div>
              )}

              {/* Instructions */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Instructions</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Provide clear instructions for your students..."
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Due Date / Time / Est. Minutes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Due Date *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Due Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Est. Completion</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={estimatedMinutes}
                      onChange={e => setEstimatedMinutes(Number(e.target.value))}
                      min={5}
                      max={480}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-slate-500 text-sm whitespace-nowrap">min</span>
                  </div>
                </div>
              </div>

              {/* Allow Late */}
              <div className="flex items-center justify-between p-4 bg-slate-800/60 rounded-xl border border-slate-700">
                <div>
                  <p className="text-white font-medium text-sm">Allow Late Submissions</p>
                  <p className="text-slate-500 text-xs mt-0.5">Students can submit after the due date</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowLate(!allowLate)}
                  className={cn("w-12 h-6 rounded-full transition-colors relative", allowLate ? 'bg-indigo-500' : 'bg-slate-700')}
                >
                  <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-all", allowLate ? 'left-7' : 'left-1')} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: RESOURCES ── */}
          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
              
              {submissionType === 'INTERACTIVE' ? (
                <div className="space-y-6">
                  <div className="p-8 bg-indigo-500/5 border border-indigo-500/20 rounded-[2rem] text-center">
                    <Target className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Digital Worksheet Architect</h3>
                    <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                      Build a premium, multi-page interactive worksheet with custom questions, marks, and hints.
                    </p>
                    
                    <div className="mt-8 flex flex-col items-center gap-4">
                      <button
                        onClick={async () => {
                          if (!assignmentId) {
                            // Ensure assignment exists as draft first
                            setSubmitting(true);
                            try {
                              const payload = {
                                title,
                                teacher_id: userId,
                                class_id: selectedClassId,
                                subject_id: selectedSubjectId,
                                due_date: `${dueDate}T${dueTime}:00`,
                                allow_late_submission: allowLate,
                                submission_type: 'INTERACTIVE',
                                type: 'ONLINE_AUTO_GRADED',
                                total_marks: 100,
                                status: 'DRAFT',
                              };
                              console.log('Creating assignment draft:', payload);
                              const { data, error } = await supabase.from('assignments').insert(payload).select().single();
                              if (error) {
                                console.error('Assignment insert error:', error);
                                alert(`Error: ${error.message}`);
                                return;
                              }
                              console.log('Assignment created:', data);
                              setAssignmentId(data.id);
                              setShowWorksheetBuilder(true);
                            } catch (err: any) {
                              console.error('Unexpected error:', err);
                              alert(`Unexpected error: ${err.message}`);
                            } finally {
                              setSubmitting(false);
                            }
                          } else {
                            setShowWorksheetBuilder(true);
                          }
                        }}

                        className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        {assignmentId ? 'Modify Worksheet Blueprint' : 'Initialize Worksheet Blueprint'}
                      </button>
                      
                      {assignmentId && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                          <Check className="w-3 h-3" /> Blueprint Linked: {assignmentId.split('-')[0]}...
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Worksheet Overlay Modal */}
                  {showWorksheetBuilder && assignmentId && (
                    <div className="fixed inset-0 z-[100] bg-black">
                      <PremiumWorksheetBuilder 
                        assignmentId={assignmentId} 
                        onClose={() => setShowWorksheetBuilder(false)}
                        onSave={() => {
                          // Could fetch page count here if needed
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-white font-semibold text-lg">Upload Assignment Resources</h3>
                    <p className="text-slate-400 text-sm mt-1">Add question papers, worksheets, and reference materials. Students will be able to download these.</p>
                  </div>

                  {/* Upload area */}
                  <label className="flex flex-col items-center justify-center gap-3 w-full h-36 border-2 border-dashed border-slate-600 rounded-2xl hover:border-indigo-500 hover:bg-slate-800/30 cursor-pointer transition-all group">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                      onChange={e => {
                        Array.from(e.target.files || []).forEach(f => addFile(f, 'QUESTION_PAPER'));
                        e.target.value = '';
                      }}
                    />
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    <div className="text-center">
                      <p className="text-slate-300 font-medium group-hover:text-white transition-colors">Click to upload files</p>
                      <p className="text-slate-500 text-sm">PDF, DOCX, PNG, JPG supported</p>
                    </div>
                  </label>

                  {/* File list */}
                  {filesToUpload.length > 0 && (
                    <div className="space-y-2">
                      {filesToUpload.map((af, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{af.file.name}</p>
                            <p className="text-slate-500 text-xs">{(af.file.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <select
                            value={af.fileType}
                            onChange={e => changeFileType(idx, e.target.value as any)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {FILE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <button onClick={() => removeFile(idx)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {filesToUpload.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      No files added. You can skip this step and add files later.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: VISIBILITY ── */}
          {step === 3 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
              <div>
                <h3 className="text-white font-semibold text-lg">Assignment Visibility</h3>
                <p className="text-slate-400 text-sm mt-1">Control exactly which students receive this assignment.</p>
              </div>

              {/* Mode selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'CLASS', label: 'Entire Class', desc: `All ${eligibleStudents.length} enrolled students`, icon: Users },
                  { value: 'SPECIFIC', label: 'Specific Students', desc: 'Handpick individual students', icon: UserCheck },
                  { value: 'GROUP', label: 'Student Group', desc: 'Assign to a pre-defined group', icon: Target },
                ].map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVisibilityType(value as any)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all",
                      visibilityType === value
                        ? 'bg-indigo-500/10 border-indigo-500'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                    )}
                  >
                    <Icon className={cn("w-5 h-5 mb-2", visibilityType === value ? 'text-indigo-400' : 'text-slate-500')} />
                    <p className="font-semibold text-white text-sm">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>

              {/* SPECIFIC: student multi-select */}
              {visibilityType === 'SPECIFIC' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Search students..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {filteredStudents.map(student => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudents(prev =>
                          prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]
                        )}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                          selectedStudents.includes(student.id)
                            ? 'bg-indigo-500/10 border-indigo-500/50'
                            : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0",
                          selectedStudents.includes(student.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                        )}>
                          {selectedStudents.includes(student.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{student.full_name}</p>
                          {student.admission_number && <p className="text-slate-500 text-xs">{student.admission_number}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{selectedStudents.length} of {eligibleStudents.length} students selected</p>
                </div>
              )}

              {/* GROUP: group selector */}
              {visibilityType === 'GROUP' && (
                <div className="space-y-2">
                  {studentGroups.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm bg-slate-800/40 rounded-xl border border-slate-700">
                      No student groups found for this class and subject.
                    </div>
                  ) : (
                    studentGroups.map(grp => (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => setSelectedGroupId(grp.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                          selectedGroupId === grp.id ? 'bg-indigo-500/10 border-indigo-500' : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                        )}
                      >
                        <Users className="w-5 h-5 text-indigo-400" />
                        <div className="flex-1">
                          <p className="text-white font-medium">{grp.group_name}</p>
                          <p className="text-slate-500 text-xs">{grp.member_count} members</p>
                        </div>
                        {selectedGroupId === grp.id && <Check className="w-4 h-4 text-indigo-400" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: REVIEW ── */}
          {step === 4 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <h3 className="text-white font-semibold text-lg">Review & Publish</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Assignment Details */}
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 space-y-3">
                  <h4 className="text-indigo-400 font-semibold flex items-center gap-2 text-sm uppercase tracking-wide">
                    <BookOpen className="w-4 h-4" /> Assignment Details
                  </h4>
                  {[
                    ['Title', title],
                    ['Class', classes.find(c => c.id === selectedClassId)?.name || '—'],
                    ['Subject', subjects.find(s => s.id === selectedSubjectId)?.name || '—'],
                    ['Due Date', dueDate ? `${dueDate} @ ${dueTime}` : '—'],
                    ['Est. Duration', `${estimatedMinutes} minutes`],
                    ['Submission', SUBMISSION_TYPES.find(s => s.value === submissionType)?.label || '—'],
                    ['Late Allowed', allowLate ? 'Yes' : 'No'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-start text-sm">
                      <span className="text-slate-400 shrink-0">{k}:</span>
                      <span className="text-slate-100 text-right">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Visibility Summary */}
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 space-y-3">
                  <h4 className="text-emerald-400 font-semibold flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Users className="w-4 h-4" /> Visibility Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Mode:</span><span className="text-slate-100">{visibilityType}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Recipients:</span><span className="text-emerald-400 font-semibold">{getRecipientSummary()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Files:</span><span className="text-slate-100">{filesToUpload.length} resource{filesToUpload.length !== 1 ? 's' : ''}</span></div>
                    {selectedEventId && <div className="flex justify-between"><span className="text-slate-400">Event:</span><span className="text-slate-100">{tuitionEvents.find(e => e.id === selectedEventId)?.event_name}</span></div>}
                  </div>

                  {instructions && (
                    <div className="pt-3 border-t border-slate-700">
                      <p className="text-slate-400 text-xs font-medium mb-1">Instructions</p>
                      <p className="text-slate-300 text-sm line-clamp-4">{instructions}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Publish notice */}
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm text-indigo-300">
                <p className="font-medium">Ready to publish?</p>
                <p className="text-indigo-400/70 mt-0.5">Publishing immediately notifies all recipients. You can also save as draft and publish later.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            {step < 4 ? (
              <button
                onClick={() => {
                  if (!validateStep(step)) return;
                  setStep(s => s + 1);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-slate-600 hover:border-slate-500 text-slate-200 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Publish Assignment
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
