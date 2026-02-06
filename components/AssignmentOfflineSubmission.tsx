'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Upload, FileText, CheckCircle, Download, 
  AlertCircle, Paperclip, Clock 
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AssignmentOfflineSubmissionProps {
  assignment: any;
  studentId: string;
  onComplete: () => void;
}

export default function AssignmentOfflineSubmission({ 
  assignment, 
  studentId, 
  onComplete 
}: AssignmentOfflineSubmissionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const submission = assignment.submission; // Pre-fetched submission
  const isSubmitted = !!submission;

  const handleSubmit = async () => {
    if (!file && !notes) {
      setError('Please upload a file or add submission notes.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let attachmentUrls: string[] = [];

      // 1. Upload File
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${studentId}/${assignment.id}/${Math.random().toString(36).substr(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assignment-submissions') // Ensure bucket exists
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('assignment-submissions')
          .getPublicUrl(fileName);
        
        attachmentUrls.push(publicUrl);
      }

      // 2. Insert Submission Record
      const { error: dbError } = await supabase
        .from('student_submissions')
        .insert({
            assignment_id: assignment.id,
            student_id: studentId,
            submission_content: notes,
            attachment_urls: attachmentUrls,
            status: 'SUBMITTED',
            submitted_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      onComplete();

    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit assignment');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
       {/* Assignment Details Card */}
       <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8">
          <div className="flex items-start justify-between mb-6">
              <div>
                  <h1 className="text-2xl font-bold text-white mb-2">{assignment.title}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1.5 bg-slate-700/50 px-3 py-1 rounded-full">
                          <Clock className="w-4 h-4 text-indigo-400" />
                          Due: {format(new Date(assignment.due_date), 'PPP p')}
                      </span>
                      <span className="flex items-center gap-1.5 bg-slate-700/50 px-3 py-1 rounded-full">
                         <span className="font-bold text-emerald-400">{assignment.total_marks}</span> Marks
                      </span>
                  </div>
              </div>
              
              {/* Status Badge */}
              <div className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-bold border",
                  isSubmitted 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              )}>
                  {isSubmitted ? (submission.status === 'MARKED' ? 'GRADED' : 'SUBMITTED') : 'PENDING'}
              </div>
          </div>

          <div className="prose prose-invert max-w-none mb-8">
              <h3 className="text-slate-300 font-semibold mb-2">Instructions</h3>
              <p className="text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {assignment.description || 'No instructions provided.'}
              </p>
          </div>

          {assignment.attachment_url && (
              <a 
                href={assignment.attachment_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-all group"
              >
                  <div className="p-2 bg-indigo-500/20 rounded-lg group-hover:bg-indigo-500 text-indigo-300 group-hover:text-white transition-colors">
                      <Download className="w-5 h-5" />
                  </div>
                  <div>
                      <p className="font-medium text-indigo-300 group-hover:text-white">Download Attached Resource</p>
                      <p className="text-xs text-indigo-400/70">Reference Material</p>
                  </div>
              </a>
          )}
       </div>

       {/* Submission Area */}
       {isSubmitted ? (
           <div className="bg-slate-800/50 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 md:p-8 space-y-4">
               <div className="flex items-center gap-3 text-emerald-400 mb-2">
                   <div className="p-2 bg-emerald-500/20 rounded-full">
                       <CheckCircle className="w-6 h-6" />
                   </div>
                   <h2 className="text-xl font-bold">Assignment Submitted</h2>
               </div>
               
               <div className="grid md:grid-cols-2 gap-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Submitted At</p>
                        <p className="text-slate-300 font-mono">
                            {format(new Date(submission.submitted_at), 'PPP p')}
                        </p>
                    </div>
                    {submission.score !== null && (
                         <div>
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Grade</p>
                            <p className="text-2xl font-bold text-emerald-400">
                                {submission.score} <span className="text-sm text-slate-500">/ {assignment.total_marks}</span>
                            </p>
                        </div>
                    )}
               </div>

               {submission.teacher_feedback && (
                   <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                       <p className="text-xs text-indigo-400 uppercase font-bold mb-2">Teacher Feedback</p>
                       <p className="text-slate-300 italic">"{submission.teacher_feedback}"</p>
                   </div>
               )}
           </div>
       ) : (
           <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8 space-y-6">
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                   <Upload className="w-5 h-5 text-indigo-400" />
                   Your Submission
               </h2>

               {error && (
                   <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
                       <AlertCircle className="w-5 h-5" />
                       {error}
                   </div>
               )}

               <div className="space-y-4">
                   {/* File Upload Area */}
                   <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-300">Upload Document (Optional)</label>
                       <div className="relative group">
                           <input 
                             type="file" 
                             onChange={(e) => setFile(e.target.files?.[0] || null)}
                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                           />
                           <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center transition-all group-hover:border-indigo-500 group-hover:bg-slate-800/80">
                               {file ? (
                                   <div className="flex items-center gap-3 text-indigo-400">
                                       <FileText className="w-8 h-8" />
                                       <span className="font-medium text-lg">{file.name}</span>
                                   </div>
                               ) : (
                                   <>
                                       <Upload className="w-8 h-8 text-slate-500 mb-2 group-hover:text-indigo-400 transition-colors" />
                                       <p className="text-slate-400 font-medium">Click to upload file</p>
                                       <p className="text-xs text-slate-500 mt-1">PDF, Word, or Image</p>
                                   </>
                               )}
                           </div>
                       </div>
                   </div>

                   {/* Notes Area */}
                   <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-300">Notes / Text Answer (Optional)</label>
                       <textarea 
                           value={notes}
                           onChange={(e) => setNotes(e.target.value)}
                           rows={4}
                           placeholder="Type your answer here or leave a note for the teacher..."
                           className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                       />
                   </div>

                   <Button 
                       onClick={handleSubmit}
                       disabled={uploading}
                       className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-indigo-500/25 transition-all text-lg"
                   >
                       {uploading ? 'Submitting...' : 'Submit Assignment'}
                   </Button>
               </div>
           </div>
       )}
    </div>
  );
}
