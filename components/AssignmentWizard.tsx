'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  X, Check, ChevronRight, ChevronLeft, Upload, FileText, 
  Calendar, Settings, Users, BookOpen, Clock, AlertCircle, 
  Loader2, Wifi, WifiOff, List
} from 'lucide-react';
import { cn } from '@/lib/utils';
import QuestionBuilder, { Question } from '@/components/QuestionBuilder';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AssignmentWizardProps {
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
}

export default function AssignmentWizard({ onClose, userId, onSuccess }: AssignmentWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data State
  const [title, setTitle] = useState('');
  const [selectedCurriculum, setSelectedCurriculum] = useState(''); // 'CBC' or '8-4-4'
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [type, setType] = useState<'ONLINE_AUTO_GRADED' | 'OFFLINE_DOCUMENT_BASED'>('OFFLINE_DOCUMENT_BASED');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [totalMarks, setTotalMarks] = useState(100);
  const [description, setDescription] = useState('');
  const [allowLate, setAllowLate] = useState(true);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');

  // Offline Specific
  const [attachment, setAttachment] = useState<File | null>(null);
  
  // Online Specific
  const [questions, setQuestions] = useState<Question[]>([]);

  // Metadata Lists
  const [classes, setClasses] = useState<{id: string, name: string, form_level: string, subjects: string[]}[]>([]);
  const [subjects, setSubjects] = useState<{id: string, name: string}[]>([]); // Resolved subject objects

  // Fetch classes and resolve subject names to IDs
  useEffect(() => {
    async function fetchData() {
      try {
        // 0. Check User Role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const role = profile?.role;

        if (role === 'admin') {
            // ADMIN STRATEGY: Fetch ALL Classes and ALL Subjects
            const { data: allClasses } = await supabase
                .from('classes')
                .select('id, name, form_level'); // Admins can assign to any class
            
            // We need subjects too. Ideally classes have subjects? 
            // The table schema for `classes` might not have `subjects` array if it's strictly normalized? 
            // In the Teacher query we got `subjects` from `teacher_classes`.
            // Let's assume for Admin we fetch ALL subjects available in the system or we need to know which subjects a class takes.
            // If `classes` table doesn't have subjects, we might need to fetch all subjects and let admin choose?
            // But the UI relies on `cls.subjects.includes(s.name)`.
            // Let's assume for now we list all subjects for all classes for Admins? 
            // Or better: Fetch all subjects, and modify the filter filter logic?
            // Actually, the teacher logic `classes` state expects `{id, name, subjects[]}`.
            // If `classes` table doesn't have `subjects` column, we have a problem.
            // Let's check `classes` schema via a small view? No, I'll rely on common sense first.
            // If the `teacher_classes` query worked: `classes!inner (id, name, form_level)`... wait, `subjects` came from `teacher_classes` (the join table).
            // So `classes` table likely DOES NOT have `subjects`.
            
            // If `classes` table doesn't have subjects, how do we know what subjects a class takes?
            // Usually valid usage: Admin assigns "Mathematics" to "Form 1".
            // If we don't strict filter subjects for admins, it might be fine.
            // Let's just give Admins ALL classes and ALL subjects.
            
            if (allClasses) {
                // Mock subjects into the class object or fetch real ones?
                // Let's fetch all subjects first.
                const { data: allSubjects } = await supabase.from('subjects').select('id, name');
                if (allSubjects) {
                    setSubjects(allSubjects);
                    
                    // For Admin, we can say every class "supports" every subject (flexible) 
                    // OR we just map all subject names to every class so the filter passes.
                    const allSubjectNames = allSubjects.map(s => s.name);
                    
                    setClasses(allClasses.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        form_level: c.form_level,
                        subjects: allSubjectNames // Allow admin to pick ANY subject for ANY class
                    })));
                }
            }
            
        } else {
            // TEACHER STRATEGY (Existing)
            // 1. Fetch Teacher Classes
            const { data: teacherClasses } = await supabase
              .from('teacher_classes')
              .select(`
                class_id,
                subjects,
                classes!inner (id, name, form_level)
              `)
              .eq('teacher_id', userId);
    
            if (!teacherClasses) return;
    
            // Process Classes
            const processedClasses = teacherClasses.map((tc: any) => ({
              id: tc.class_id,
              name: tc.classes.name,
              form_level: tc.classes.form_level,
              subjects: tc.subjects || []
            }));
            setClasses(processedClasses);
    
            // 2. Fetch All Subjects to Map Names -> IDs
            const allSubjectNames = Array.from(new Set(processedClasses.flatMap(c => c.subjects)));
            
            if (allSubjectNames.length > 0) {
                const { data: subjectData } = await supabase
                .from('subjects')
                .select('id, name')
                .in('name', allSubjectNames);
                
                if (subjectData) {
                    setSubjects(subjectData);
                }
            }
        }

      } catch (err) {
        console.error('Error fetching wizard data:', err);
      }
    }
    
    fetchData();
  }, [userId]);

  // Derived: Filter Classes based on selected Curriculum
  const filteredClasses = React.useMemo(() => {
    if (!selectedCurriculum) return [];
    return classes.filter(c => {
        const name = c.name.toLowerCase();
        if (selectedCurriculum === 'CBC') {
            return name.startsWith('grade') || name.startsWith('pp') || name.includes('(cbc)');
        }
        // Relaxed 8-4-4 logic: Show everything that is NOT CBC
        if (selectedCurriculum === '8-4-4') {
            return !name.startsWith('grade') && !name.startsWith('pp') && !name.includes('(cbc)');
        }
        return true;
    });
  }, [classes, selectedCurriculum]);

  // Derived: Available Subjects for Selected Class
  const availableSubjects = React.useMemo(() => {
    if (!selectedClassId) return [];
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return [];
    // Filter the resolved subjects list to only include ones taught in this class
    return subjects.filter(s => cls.subjects.includes(s.name));
  }, [selectedClassId, classes, subjects]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const calculateOnlineTotalMarks = () => {
     return questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  };

  const handleSubmit = async () => {
    if (!title || !selectedClassId || !selectedSubjectId || !dueDate) {
      setError('Please fill in all required fields in Step 1');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let attachmentUrl = null;

      // 1. Upload File (if Offline mode and file exists)
      if (type === 'OFFLINE_DOCUMENT_BASED' && attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${userId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assignment-attachments')
          .upload(fileName, attachment); // Note: bucket name might vary, check buckets if fails

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('assignment-attachments')
          .getPublicUrl(fileName);
        
        attachmentUrl = publicUrl;
      }

      // 2. Insert Assignment
      const finalMarks = type === 'ONLINE_AUTO_GRADED' ? calculateOnlineTotalMarks() : totalMarks;

      const { data: assignmentData, error: insertError } = await supabase
        .from('assignments')
        .insert({
            title,
            teacher_id: userId,
            class_id: selectedClassId,
            subject_id: selectedSubjectId,
            type, 
            description,
            due_date: `${dueDate}T${dueTime}:00`,
            total_marks: finalMarks,
            allow_late_submission: allowLate,
            status, // DRAFT or PUBLISHED
            attachment_url: attachmentUrl
        })
        .select()
        .single();

      if (insertError) throw insertError;
      const assignmentId = assignmentData.id;

      // 3. Insert Questions (if Online)
      if (type === 'ONLINE_AUTO_GRADED' && questions.length > 0) {
          const formattedQuestions = questions.map((q, idx) => ({
              assignment_id: assignmentId,
              question_text: q.question_text,
              question_type: q.question_type,
              marks: q.marks,
              order_index: idx,
              correct_answer: q.correct_answer,
              options: q.options ? JSON.stringify(q.options) : null
          }));

          const { error: qError } = await supabase
            .from('assignment_questions')
            .insert(formattedQuestions);
            
          if (qError) throw qError;
      }

      if (onSuccess) onSuccess();
      onClose();

    } catch (err: any) {
      console.error('Error creating assignment:', err);
      setError(err.message || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-white">Create Assignment</h2>
            <p className="text-slate-400 text-sm">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800 w-full">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* STEP 1: BASICS */}
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Type Selection Cards */}
                <div 
                    onClick={() => setType('OFFLINE_DOCUMENT_BASED')}
                    className={cn(
                        "cursor-pointer p-4 rounded-xl border transition-all flex flex-col gap-2",
                        type === 'OFFLINE_DOCUMENT_BASED' 
                            ? "bg-indigo-500/10 border-indigo-500" 
                            : "bg-slate-800 border-slate-700 hover:border-slate-600"
                    )}
                >
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <WifiOff className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-white">Offline / Document</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Students upload a file or write a response. Manual grading required.
                    </p>
                </div>

                <div 
                    onClick={() => setType('ONLINE_AUTO_GRADED')}
                    className={cn(
                        "cursor-pointer p-4 rounded-xl border transition-all flex flex-col gap-2",
                        type === 'ONLINE_AUTO_GRADED' 
                            ? "bg-emerald-500/10 border-emerald-500" 
                            : "bg-slate-800 border-slate-700 hover:border-slate-600"
                    )}
                >
                    <div className="flex items-center gap-3 mb-1">
                         <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                            <Wifi className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-white">Online Auto-Graded</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Create quizzes with MCQs, Short Answers. Automatic grading support.
                    </p>
                </div>
              </div>

               <div className="space-y-4 pt-4 border-t border-slate-700/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block">
                          <span className="text-slate-300 font-medium mb-1.5 block">Assignment Title</span>
                          <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. History Final Project"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                      </label>

                       <label className="block">
                        <span className="text-slate-300 font-medium mb-1.5 block">Curriculum</span>
                        <select 
                          value={selectedCurriculum}
                          onChange={(e) => {
                              setSelectedCurriculum(e.target.value);
                              setSelectedClassId(''); // Reset dependency
                              setSelectedSubjectId('');
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                        >
                          <option value="">Select Curriculum</option>
                          <option value="CBC">CBC (Grade 1-6)</option>
                          <option value="8-4-4">8-4-4 (Form 1-4)</option>
                        </select>
                      </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <label className="block">
                      <span className="text-slate-300 font-medium mb-1.5 block">Class</span>
                      <select 
                        value={selectedClassId}
                        onChange={(e) => {
                            setSelectedClassId(e.target.value);
                            setSelectedSubjectId(''); // Reset subject when class changes
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                        disabled={!selectedCurriculum}
                      >
                        <option value="">Select Class</option>
                        {filteredClasses.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.form_level})</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-slate-300 font-medium mb-1.5 block">Subject</span>
                      <select 
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        disabled={!selectedClassId}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none disabled:opacity-50"
                      >
                        <option value="">Select Subject</option>
                        {availableSubjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-slate-300 font-medium mb-1.5 block">Due Date</span>
                      <input 
                        type="date" 
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </label>
                    <label className="block">
                      <span className="text-slate-300 font-medium mb-1.5 block">Due Time</span>
                      <input 
                        type="time" 
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </label>
                  </div>
              </div>
            </div>
          )}

          {/* STEP 2: CONTENT */}
          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
               <label className="block">
                    <span className="text-slate-300 font-medium mb-1.5 block">Instructions / Description</span>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide detailed instructions for your students..."
                      rows={4}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
               </label>

               {/* OFFLINE MODE CONTENT */}
               {type === 'OFFLINE_DOCUMENT_BASED' && (
                  <div className="space-y-6">
                      <div>
                        <span className="text-slate-300 font-medium mb-1.5 block">Attach Resource (Optional)</span>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-slate-800/50 transition-all cursor-pointer group">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 mb-2 transition-colors" />
                            <p className="text-sm text-slate-400 group-hover:text-slate-300">
                              {attachment ? attachment.name : 'Click to upload'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">PDF, DOCX, IMG</p>
                          </div>
                          <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                      </div>

                       <div className="flex items-center justify-between">
                          <span className="text-slate-300">Total Marks</span>
                          <input 
                            type="number" 
                            value={totalMarks} 
                            onChange={(e) => setTotalMarks(Number(e.target.value))}
                            className="w-24 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 text-right font-mono"
                          />
                        </div>
                  </div>
               )}

               {/* ONLINE MODE CONTENT */}
               {type === 'ONLINE_AUTO_GRADED' && (
                   <div className="space-y-4">
                       <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                           <h3 className="text-lg font-bold text-white">Question Builder</h3>
                           <div className="text-sm text-slate-400">
                               Total Marks: <span className="text-emerald-400 font-mono font-bold">{calculateOnlineTotalMarks()}</span>
                           </div>
                       </div>
                       <QuestionBuilder questions={questions} onChange={setQuestions} />
                   </div>
               )}
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 space-y-3">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-400" />
                            Details
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Title:</span>
                                <span className="text-slate-200">{title}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Class:</span>
                                <span className="text-slate-200">{classes.find(c => c.id === selectedClassId)?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Subject:</span>
                                <span className="text-slate-200">{subjects.find(s => s.id === selectedSubjectId)?.name}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-slate-400">Due:</span>
                                <span className="text-slate-200">{dueDate} @ {dueTime}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 space-y-3">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <Settings className="w-4 h-4 text-emerald-400" />
                            Settings
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Type:</span>
                                <span className="text-slate-200">
                                    {type === 'ONLINE_AUTO_GRADED' ? 'Online Quiz' : 'Document'}
                                </span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-slate-400">Grading:</span>
                                <span className="text-slate-200">
                                    {type === 'ONLINE_AUTO_GRADED' ? 'Auto-Graded' : 'Manual'}
                                </span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-slate-400">Total Marks:</span>
                                <span className="text-slate-200 font-mono">
                                     {type === 'ONLINE_AUTO_GRADED' ? calculateOnlineTotalMarks() : totalMarks}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Publish Immediately?</h4>
                    <p className="text-indigo-200 text-xs">If disabled, assignment will be saved as a DRAFT.</p>
                  </div>
                  <button 
                    onClick={() => setStatus(status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      status === 'PUBLISHED' ? "bg-indigo-500" : "bg-slate-700"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                      status === 'PUBLISHED' ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-between items-center">
          {step > 1 ? (
            <button 
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div></div> // Spacer
          )}

          {step < 3 ? (
            <button 
              onClick={() => {
                if (step === 1 && (!title || !selectedCurriculum || !selectedClassId || !selectedSubjectId || !dueDate)) {
                  setError('Please fill in required fields');
                  return;
                }
                setError('');
                setStep(step + 1);
              }}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all flex items-center gap-2 font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {status === 'PUBLISHED' ? 'Publish Assignment' : 'Save Draft'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
