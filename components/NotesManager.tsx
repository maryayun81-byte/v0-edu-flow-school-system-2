'use client';

import React from "react"

import { useState } from 'react';
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Only PDF and DOCX files are allowed');
        return;
      }

      // Validate file size (max 10MB)
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
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Create note record in database
      const { error: dbError } = await supabase.from('notes').insert([
        {
          title,
          description,
          file_url: publicUrlData.publicUrl,
          file_path: filePath,
          created_by: userId,
        },
      ]);

      if (dbError) {
        throw new Error(dbError.message);
      }

      // Create notification for students
      await supabase.from('notifications').insert([
        {
          type: 'note',
          title: 'New Study Material',
          message: `New note added: ${title}`,
          created_by: userId,
        },
      ]);

      // Show success and close
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
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-xl border-b border-white/10 p-4 sm:p-6">
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
