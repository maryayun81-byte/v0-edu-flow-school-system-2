'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, X, FileText, Loader, Sparkles, CheckCircle2 } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface NotesManagerProps {
  onClose: () => void;
  userId: string;
}

export default function NotesManager({ onClose, userId }: NotesManagerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Metadata Selection State
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  
  // Data State
  const [classes, setClasses] = useState<{id: string, name: string, form_level: string, subjects: string[]}[]>([]);
  const [subjects, setSubjects] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!userId) return;
        
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
      } catch (err) {
        console.error('Error fetching teacher data:', err);
      }
    }
    fetchData();
  }, [userId]);

  // Filter Classes based on Curriculum
  const filteredClasses = useMemo(() => {
    if (!selectedCurriculum) return [];
    return classes.filter(c => {
        const name = c.name.toLowerCase();
        if (selectedCurriculum === 'CBC') {
            return name.startsWith('grade') || name.startsWith('pp') || name.includes('(cbc)');
        }
        if (selectedCurriculum === '8-4-4') {
            return !name.startsWith('grade') && !name.startsWith('pp') && !name.includes('(cbc)');
        }
        return true;
    });
  }, [classes, selectedCurriculum]);

  // Available Subjects for Selected Class
  const availableSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return [];
    return subjects.filter(s => cls.subjects.includes(s.name));
  }, [selectedClassId, classes, subjects]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Only PDF and DOCX files are allowed');
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setError('');
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !file) {
      setError('Please fill in all fields and select a file');
      return;
    }
    
    if (!selectedClassId || !selectedSubjectId) {
        setError('Please select a class and subject');
        return;
    }

    if (!userId) {
      setError('User ID is missing. Please log in again.');
      return;
    }

    setLoading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `notes/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('notes') // Changed to 'notes' bucket
        .upload(filePath, file);

      if (uploadError) {
        // Fallback to 'documents' if notes bucket fails (backward compatibility)
        if (uploadError.message.includes('bucket')) {
             const { error: fallbackError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);
             if (fallbackError) throw new Error(fallbackError.message);
        } else {
             throw new Error(uploadError.message);
        }
      }

      // Get public URL (Check both buckets)
      let publicUrl = supabase.storage.from('notes').getPublicUrl(filePath).data.publicUrl;
      
      // Create note record in database
      const { error: dbError } = await supabase.from('notes').insert([
        {
          title,
          description,
          file_url: publicUrl,
          file_path: filePath,
          created_by: userId,
          class_id: selectedClassId, // Add Class relation
          subject_id: selectedSubjectId // Add Subject relation
        },
      ]);

      if (dbError) {
        throw new Error(dbError.message);
      }

      // Create notification
      const className = classes.find(c => c.id === selectedClassId)?.name;
      const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name;
      
      await supabase.from('notifications').insert([
        {
          type: 'note',
          title: 'New Study Material',
          message: `New ${subjectName} note for ${className}: ${title}`,
          created_by: userId,
          target_class_id: selectedClassId // Target specific class
        },
      ]);

      setSuccess(true);
      setTimeout(() => {
        setTitle('');
        setDescription('');
        setFile(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to upload note');
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-xl border-b border-white/10 p-4 sm:p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Add New Note</h2>
                <p className="text-xs sm:text-sm text-indigo-300">Share study materials with students</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-4 sm:mx-6 mt-4 sm:mt-6 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 animate-[slideIn_0.3s_ease-out]">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-400 font-medium">Note uploaded successfully!</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 sm:mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* Metadata Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
              <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Curriculum</label>
                  <select 
                      value={selectedCurriculum}
                      onChange={(e) => {
                          setSelectedCurriculum(e.target.value);
                          setSelectedClassId('');
                          setSelectedSubjectId('');
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                      <option value="">Select...</option>
                      <option value="CBC">CBC</option>
                      <option value="8-4-4">8-4-4</option>
                  </select>
              </div>

              <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Class</label>
                  <select 
                      value={selectedClassId}
                      onChange={(e) => {
                          setSelectedClassId(e.target.value);
                          setSelectedSubjectId(''); // Reset subject
                      }}
                      disabled={!selectedCurriculum}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                      <option value="">Select Class...</option>
                      {filteredClasses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
              </div>

              <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Subject</label>
                  <select 
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      disabled={!selectedClassId}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                      <option value="">Select Subject...</option>
                      {availableSubjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
              </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Note Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chapter 1 - Introduction to Physics"
              className="w-full px-4 py-3 sm:py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the study material..."
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload File (PDF or DOCX) <span className="text-red-400">*</span>
            </label>
            <div className="relative border-2 border-dashed border-indigo-500/30 rounded-xl p-6 sm:p-8 text-center hover:border-indigo-500/50 transition-all cursor-pointer bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="pointer-events-none">
                <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-400 mx-auto mb-3" />
                {file ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-white text-sm sm:text-base">{file.name}</p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p className="text-xs text-indigo-400 mt-2">Click to change file</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold text-white text-sm sm:text-base">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      PDF or DOCX (max 10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="w-full sm:flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 sm:py-3.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 order-1 sm:order-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Uploaded!
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Upload Note
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
