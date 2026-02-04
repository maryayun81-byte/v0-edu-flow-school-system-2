'use client';

import React from "react"

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, X, Loader } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AssignmentsManagerProps {
  onClose: () => void;
  userId: string;
}

export default function AssignmentsManager({ onClose, userId }: AssignmentsManagerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !dueDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (!userId) {
      setError('User ID is missing. Please log in again.');
      return;
    }

    setLoading(true);

    try {
      const { error: dbError } = await supabase.from('assignments').insert([
        {
          title,
          description,
          due_date: dueDate,
          github_repo_link: githubLink || null,
          created_by: userId,
        },
      ]);

      if (dbError) {
        throw new Error(dbError.message);
      }

      // Create notification for students
      await supabase.from('notifications').insert([
        {
          type: 'assignment',
          title: 'New Assignment',
          message: `New assignment: ${title} - Due: ${new Date(dueDate).toLocaleDateString()}`,
          created_by: userId,
        },
      ]);

      // Reset form and close
      setTitle('');
      setDescription('');
      setDueDate('');
      setGithubLink('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create assignment');
      console.error('Create assignment error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-8 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Add New Assignment</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-300 font-semibold mb-2">
            Assignment Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Problem Set 1"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-gray-300 font-semibold mb-2">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what students need to do..."
            rows={4}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-gray-300 font-semibold mb-2">
            Due Date *
          </label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-gray-300 font-semibold mb-2">
            GitHub Repository Link (Optional)
          </label>
          <input
            type="url"
            value={githubLink}
            onChange={(e) => setGithubLink(e.target.value)}
            placeholder="https://github.com/username/repo"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3.5 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Create Assignment
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-8 bg-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/20 transition-all border border-white/10"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
