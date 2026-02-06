'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  X, Check, ChevronRight, ChevronLeft, Upload, FileText, 
  Calendar, Settings, Users, BookOpen, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [marks, setMarks] = useState(100);
  const [instructions, setInstructions] = useState('');
  
  // Settings
  const [submissionType, setSubmissionType] = useState<'text' | 'file' | 'both'>('both');
  const [allowLate, setAllowLate] = useState(true);
  const [isPublished, setIsPublished] = useState(false);

  // Attachment
  const [attachment, setAttachment] = useState<File | null>(null);
  // Data Lists
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [classSubjectsMap, setClassSubjectsMap] = useState<Record<string, string[]>>({});

  // Fetch classes and subjects on mount
  // Fetch classes and subjects on mount
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch All Teacher Classes with their assigned subjects
        const { data: teacherClasses } = await supabase
          .from('teacher_classes')
          .select(`
            subjects,
            classes!inner (
              name, 
              form_level
            )
          `)
          .eq('teacher_id', userId);

        if (teacherClasses) {
          const clsSubMap: Record<string, string[]> = {};
          
          teacherClasses.forEach((tc: any) => {
            const className = `${tc.classes.name} (${tc.classes.form_level})`;
            // Start with existing subjects for this class or empty array
            const currentSubjects = clsSubMap[className] || [];
            
            // Add new subjects if they exist
            if (Array.isArray(tc.subjects)) {
              // tc.subjects is array of strings (names) as per schema/usage
              tc.subjects.forEach((s: string) => {
                if (!currentSubjects.includes(s)) {
                  currentSubjects.push(s);
                }
              });
            }
            clsSubMap[className] = currentSubjects;
          });

          setClassSubjectsMap(clsSubMap);
          setAvailableClasses(Object.keys(clsSubMap));
        }
      } catch (err) {
        console.error('Error fetching wizard data:', err);
      }
    }
    
    fetchData();
  }, [userId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!title || !className || !subject || !dueDate) {
      setError('Please fill in all required fields in Step 1');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let attachmentUrl = null;

      // 1. Upload File (if any)
      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('assignment-attachments')
          .upload(filePath, attachment);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('assignment-attachments')
          .getPublicUrl(filePath);
        
        attachmentUrl = publicUrl;
      }

      // 2. Insert Assignment
      const { error: insertError } = await supabase.from('assignments').insert({
        title,
        class_name: className, // Using text column for now as verified in schema plan
        subject,
        description: instructions,
        due_date: `${dueDate}T${dueTime}:00`,
        max_marks: marks,
        submission_type: submissionType,
        allow_late_submissions: allowLate,
        is_published: isPublished,
        user_id: userId,
        attachment_urls: attachmentUrl ? [attachmentUrl] : [],
      });

      if (insertError) throw insertError;

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
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
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

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-slate-300 font-medium mb-1.5 block">Assignment Title</span>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Calculus Mid-Term Project"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-slate-300 font-medium mb-1.5 block">Subject</span>
                    <select 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={!className}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none disabled:opacity-50"
                    >
                      <option value="">Select Subject</option>
                      {className && classSubjectsMap[className]?.map(subj => (
                        <option key={subj} value={subj}>{subj}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-medium mb-1.5 block">Class</span>
                    <select 
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                    >
                      <option value="">Select Class</option>
                      {availableClasses.map(c => (
                        <option key={c} value={c}>{c}</option>
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

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <label className="block">
                <span className="text-slate-300 font-medium mb-1.5 block">Instructions</span>
                <textarea 
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Detailed instructions for the students..."
                  rows={6}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </label>

              <div>
                <span className="text-slate-300 font-medium mb-1.5 block">Attach File (Optional)</span>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-slate-800/50 transition-all cursor-pointer group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 mb-2 transition-colors" />
                    <p className="text-sm text-slate-400 group-hover:text-slate-300">
                      {attachment ? attachment.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOCX, ZIP up to 10MB</p>
                  </div>
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-400" />
                    Configuration
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Submission Type</span>
                      <select 
                        value={submissionType} 
                        onChange={(e: any) => setSubmissionType(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="text">Text Only</option>
                        <option value="file">File Upload</option>
                        <option value="both">Both</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Max Marks</span>
                      <input 
                        type="number" 
                        value={marks} 
                        onChange={(e) => setMarks(Number(e.target.value))}
                        className="w-20 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Allow Late Submissions</span>
                      <button 
                        onClick={() => setAllowLate(!allowLate)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          allowLate ? "bg-green-500" : "bg-slate-700"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                          allowLate ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    Review
                  </h3>
                   <div className="space-y-2 text-sm text-slate-400">
                    <p><strong className="text-slate-300">Title:</strong> {title || 'Untitled'}</p>
                    <p><strong className="text-slate-300">Class:</strong> {className || 'None'}</p>
                    <p><strong className="text-slate-300">Due:</strong> {dueDate} at {dueTime}</p>
                    <p><strong className="text-slate-300">Attachment:</strong> {attachment ? attachment.name : 'None'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Publish Now?</h4>
                    <p className="text-indigo-200 text-xs">Students will be notified immediately.</p>
                  </div>
                  <button 
                    onClick={() => setIsPublished(!isPublished)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      isPublished ? "bg-indigo-500" : "bg-slate-700"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                      isPublished ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
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
                if (step === 1 && (!title || !className || !subject || !dueDate)) {
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
              {isPublished ? 'Publish Assignment' : 'Save as Draft'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
