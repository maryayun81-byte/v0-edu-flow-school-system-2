'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  FileText, BookOpen, Clock, Download, ExternalLink,
  Search, AlertCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const supabase = createClient();

interface Note {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
  subject_id: string;
  subjects?: { name: string };
}

interface StudentNotesManagerProps {
  studentId: string;
}

export default function StudentNotesManager({ studentId }: StudentNotesManagerProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchNotes();
  }, [studentId]);

  async function fetchNotes() {
    try {
      setLoading(true);
      
      // 1. Fetch Class Enrollments
      const { data: enrollmentData } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('student_id', studentId);

      const classIds = enrollmentData?.map(e => e.class_id) || [];

      if (classIds.length === 0) {
        setNotes([]);
        return;
      }

      // 2. Fetch Notes for these classes
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          subjects(name)
        `)
        .in('class_id', classIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);

    } catch (err) {
      console.error('Error fetching student notes:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.subjects?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Study Materials & Notes
        </h2>
        
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes, subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-slate-800/40 rounded-2xl animate-pulse border border-slate-700/50" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/20 backdrop-blur-xl rounded-3xl border border-white/5">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-slate-600" />
          </div>
          <p className="text-xl font-semibold text-slate-300 mb-2">
            {searchQuery ? 'No matching notes found' : 'No study materials yet'}
          </p>
          <p className="text-slate-500 max-w-sm mx-auto">
            {searchQuery ? 'Try adjusting your search query' : 'When your teachers upload notes for your class, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="group relative bg-slate-800/40 backdrop-blur-md border border-slate-700 rounded-2xl p-6 transition-all hover:bg-slate-800/60 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full uppercase tracking-wider mb-1">
                    {note.subjects?.name || 'General'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {format(new Date(note.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                {note.title}
              </h3>
              <p className="text-sm text-slate-400 mb-6 line-clamp-2 min-h-[2.5rem]">
                {note.description}
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
                <a
                  href={note.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/50 hover:bg-primary text-white text-sm font-semibold rounded-xl transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Note
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
