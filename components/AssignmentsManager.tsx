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
    <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-2 border-indigo-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Add New Assignment</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 p-2 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 font-semibold mb-2">
            Assignment Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Problem Set 1"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what students need to do"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-2">
            Due Date
          </label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-2">
            GitHub Repository Link (Optional)
          </label>
          <input
            type="url"
            value={githubLink}
            onChange={(e) => setGithubLink(e.target.value)}
            placeholder="https://github.com/username/repo"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            className="px-6 bg-gray-300 text-gray-900 font-semibold py-3 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
