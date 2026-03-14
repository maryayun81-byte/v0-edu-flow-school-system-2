'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, ChevronUp, ChevronDown, FileText, 
  Settings, Save, Eye, Layout, Type, List, 
  CheckSquare, Image as ImageIcon, Pencil, Hash, 
  HelpCircle, ChevronRight, ChevronLeft, MoreVertical,
  Maximize2, Move, AlertCircle, Loader2, Sigma, Table as TableIcon,
  Copy, X, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';
import dynamic from 'next/dynamic';
import PremiumWorksheetPlayer from './PremiumWorksheetPlayer';


const supabase = createClient();

// Add a helper for rendering math
function MathContent({ content, className }: { content: string, className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      try {
        renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
      }
    }
  }, [content]);

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: content }} />;
}

// Helper to convert plain text with $ to rendered math safely (optional but good for non-HTML)
function formatScienceText(text: string) {
  // Replace plain H2O patterns etc if we want, but LaTeX is better
  return text;
}


interface WorksheetPage {
  id: string;
  page_number: number;
  header_title: string;
  footer_text: string;
  questions: any[];
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  marks: number;
  hint: string;
  options: string[];
  is_required: boolean;
  order_index: number;
}

const QUESTION_TYPES = [
  { id: 'text', label: 'Short Answer', icon: Type },
  { id: 'paragraph', label: 'Paragraph', icon: FileText },
  { id: 'multiple_choice', label: 'Multiple Choice', icon: List },
  { id: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { id: 'number', label: 'Number', icon: Hash },
  { id: 'image', label: 'Image Upload', icon: ImageIcon },
  { id: 'drawing', label: 'Drawing Area', icon: Pencil },
  { id: 'equation', label: 'Math Equation', icon: Sigma },
  { id: 'table', label: 'Table Response', icon: TableIcon },
  { id: 'content_block', label: 'Reading Passage', icon: BookOpen },
];

export default function PremiumWorksheetBuilder({ 
  assignmentId, 
  onClose,
  onSave 
}: { 
  assignmentId: string; 
  onClose: () => void;
  onSave?: () => void;
}) {
  const [assignment, setAssignment] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pages, setPages] = useState<WorksheetPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchWorksheetData();
  }, [assignmentId]);

  async function fetchWorksheetData() {
    setLoading(true);
    try {
      const { data: pageData, error: pageError } = await supabase
        .from('assignment_pages')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('page_number', { ascending: true });

      if (pageError) throw pageError;

      // Fetch assignment basic info
      const { data: assignData } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();
      
      if (assignData) setAssignment(assignData);

      const { data: questionData, error: questionError } = await supabase
        .from('assignment_questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true });

      if (questionError) throw questionError;

      if (pageData && pageData.length > 0) {
        const enrichedPages = pageData.map((page: any) => ({
          ...page,
          questions: questionData?.filter((q: any) => q.page_id === page.id) || []
        }));
        setPages(enrichedPages);
      } else {
        // Initialize with one page if none exists
        console.log('No pages found, creating initial page for assignment:', assignmentId);
        const { data: newPage, error: createError } = await supabase
          .from('assignment_pages')
          .insert({
            assignment_id: assignmentId,
            page_number: 1,
            header_title: 'Unit Assessment Page 1',
            footer_text: 'Confidential • EduFlow Enterprise'
          })
          .select()
          .single();

        if (createError) throw createError;
        setPages([{ ...newPage, questions: [] }]);
      }
    } catch (err: any) {
      toast.error('Failed to load worksheet data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const addPage = async () => {
    const nextNumber = pages.length + 1;
    try {
      const { data: newPage, error } = await supabase
        .from('assignment_pages')
        .insert({
          assignment_id: assignmentId,
          page_number: nextNumber,
          header_title: `Unit Assessment Page ${nextNumber}`,
          footer_text: 'Confidential • EduFlow Enterprise'
        })
        .select()
        .single();

      if (error) throw error;
      setPages([...pages, { ...newPage, questions: [] }]);
      setActivePageIndex(pages.length);
      toast.success('New page added');
    } catch (err) {
      toast.error('Failed to add page');
    }
  };

  const removePage = async (index: number) => {
    if (pages.length <= 1) return;
    const page = pages[index];
    try {
      const { error } = await supabase.from('assignment_pages').delete().eq('id', page.id);
      if (error) throw error;

      const newPages = pages.filter((_, i) => i !== index);
      // Update page numbers for subsequent pages
      const updatedPages = newPages.map((p, i) => ({ ...p, page_number: i + 1 }));
      setPages(updatedPages);
      if (activePageIndex >= updatedPages.length) {
        setActivePageIndex(updatedPages.length - 1);
      }
      toast.success('Page removed');
    } catch (err) {
      toast.error('Failed to remove page');
    }
  };

  const addQuestion = async (type: string) => {
    const activePage = pages[activePageIndex];
    const newQuestion = {
      assignment_id: assignmentId,
      page_id: activePage.id,
      question_text: 'New Question Content...',
      question_type: type,
      marks: 1,
      hint: '',
      options: type === 'multiple_choice' || type === 'checkbox' ? ['Option 1'] : [],
      order_index: activePage.questions.length,
      is_required: true,
    };

    try {
      const { data: question, error } = await supabase
        .from('assignment_questions')
        .insert(newQuestion)
        .select()
        .single();

      if (error) throw error;

      const updatedPages = [...pages];
      updatedPages[activePageIndex].questions.push(question);
      setPages(updatedPages);
      toast.success('Question added');
    } catch (err) {
      toast.error('Failed to add question');
    }
  };

  const updateQuestion = (qIndex: number, updates: any) => {
    const updatedPages = [...pages];
    updatedPages[activePageIndex].questions[qIndex] = {
      ...updatedPages[activePageIndex].questions[qIndex],
      ...updates
    };
    setPages(updatedPages);
  };

  const removeQuestion = async (qIndex: number) => {
    const question = pages[activePageIndex].questions[qIndex];
    try {
      const { error } = await supabase.from('assignment_questions').delete().eq('id', question.id);
      if (error) throw error;

      const updatedPages = [...pages];
      updatedPages[activePageIndex].questions.splice(qIndex, 1);
      setPages(updatedPages);
      toast.success('Question removed');
    } catch (err) {
      toast.error('Failed to remove question');
    }
  };

  const saveWorksheet = async () => {
    setSaving(true);
    try {
      // Questions are atomicly saved on add/delete, but we might want to sync text/marks updates
      // Optimized: bulk update only modified questions or just all in the current page
      const currentQuestions = pages[activePageIndex].questions;
      
      for (const q of currentQuestions) {
        await supabase
          .from('assignment_questions')
          .update({
            question_text: q.question_text,
            marks: q.marks,
            hint: q.hint,
            options: q.options,
            is_required: q.is_required
          })
          .eq('id', q.id);
      }

      // Sync page metadata
      const page = pages[activePageIndex];
      await supabase
        .from('assignment_pages')
        .update({
          header_title: page.header_title,
          footer_text: page.footer_text
        })
        .eq('id', page.id);

      toast.success('Worksheet page saved successfully');
      onSave?.();
    } catch (err) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="font-bold uppercase tracking-widest text-xs">Architecting Worksheet...</p>
      </div>
    );
  }

  const activePage = pages[activePageIndex];

  if (!activePage) {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-900 border-l border-slate-800">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-medium">Initialising worksheet designer...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900 border-l border-slate-800 p-12">
        <div className="flex flex-col items-center gap-4 text-slate-400 max-w-sm text-center">
          <AlertCircle className="w-12 h-12 text-rose-500/50" />
          <div>
            <h3 className="text-white font-bold">Designer Connection Failed</h3>
            <p className="mt-2 text-xs leading-relaxed">
              We couldn't initialize the page blueprint. This is usually due to database permissions (RLS) blocking the creation of worksheet pages.
            </p>
          </div>
          <button 
            onClick={() => fetchWorksheetData()}
            className="mt-4 px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#0a0c10] overflow-hidden z-[200] flex">
      {/* ── MOBILE OVERLAY ── */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── LEFT SIDEBAR: PAGE NAVIGATION ── */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-[70] w-72 bg-[#0f1117] border-r border-slate-800 flex flex-col transition-all duration-300 lg:static",
        isSidebarOpen ? "translate-x-0 lg:w-72 lg:opacity-100" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:border-none overflow-hidden"
      )}>
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-white font-black uppercase tracking-tighter text-sm flex items-center gap-2">
              <Layout className="w-4 h-4 text-indigo-400" /> Page Blueprint
            </h2>
            <button 
              onClick={addPage}
              className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {pages.map((page, idx) => (
              <div 
                key={page.id}
                onClick={() => setActivePageIndex(idx)}
                className={cn(
                  "group relative p-4 rounded-xl border cursor-pointer transition-all duration-300",
                  activePageIndex === idx 
                    ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]" 
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black",
                    activePageIndex === idx ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-500"
                  )}>
                    {page.page_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{page.header_title}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{page.questions.length} Items</p>
                  </div>
                  {pages.length > 1 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); removePage(idx); }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-[#0a0c10] border-t border-slate-800 text-center">
            <button 
              onClick={saveWorksheet}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Syncing...' : 'Deploy Blueprint'}
            </button>
          </div>
      </div>

      {/* ── MAIN AREA: PAGE EDITOR ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* Toolbar */}
        <div className="h-auto min-h-[5rem] sm:h-20 bg-[#0f1117] border-b border-slate-800 p-3 sm:px-8 flex flex-col lg:flex-row items-center gap-3 lg:gap-6 w-full z-10 shrink-0">
          <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-between lg:justify-start">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 sm:ml-0 text-slate-400 hover:text-white transition-colors"
            >
              <Layout className="w-5 h-5" />
            </button>
            
            {/* Mobile Actions shown only on small screens next to toggle */}
            <div className="flex items-center gap-2 lg:hidden">
              <button 
                onClick={onClose}
                className="px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Close
              </button>
              <button 
                onClick={async () => {
                  await saveWorksheet();
                  setShowPreview(true);
                }}
                className="px-3 py-1.5 bg-indigo-500 text-white hover:bg-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
            <div className="hidden lg:block h-8 w-px bg-slate-800" />
          </div>
          
          {/* Scrollable Question Types */}
          <div className="flex-1 w-full overflow-x-auto no-scrollbar scroll-smooth">
            <div className="flex items-center gap-2 py-1 w-max">
               {QUESTION_TYPES.map(({ id, label, icon: Icon }) => (
                 <button 
                   key={id}
                   onClick={() => addQuestion(id)}
                   className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all text-[10px] sm:text-[11px] font-black uppercase tracking-wider whitespace-nowrap"
                 >
                   <Icon className="w-3.5 h-3.5" />
                   <span>{label}</span>
                 </button>
               ))}
            </div>
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center justify-end gap-4 shrink-0">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Close Builder
            </button>
            <button 
              onClick={async () => {
                await saveWorksheet();
                setShowPreview(true);
              }}
              className="px-6 py-2.5 bg-indigo-500 text-white hover:bg-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
            >
              <Eye className="w-5 h-5" />
              Preview Student View
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-12 bg-[#0a0c10] pattern-grid">
          <div className="max-w-4xl mx-auto space-y-8 lg:space-y-12">
            
            {/* Page Metadata Header */}
            <div className="relative group p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-dashed border-slate-800 bg-slate-900/10 hover:bg-slate-900/30 transition-all">
              <div className="absolute -top-3 left-4 lg:left-8 bg-[#0a0c10] px-3 py-1 rounded-full border border-slate-800">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page Master Head</span>
              </div>
              <input 
                value={activePage.header_title}
                onChange={(e) => {
                  const newPages = [...pages];
                  newPages[activePageIndex].header_title = e.target.value;
                  setPages(newPages);
                }}
                className="w-full bg-transparent text-lg lg:text-2xl font-black text-white placeholder:text-slate-700 focus:outline-none tracking-tight uppercase"
                placeholder="Enter Page Header Title..."
              />
            </div>

            {/* Questions Container */}
            <div className="space-y-6">
              {activePage.questions.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[3rem] text-slate-600">
                  <Plus className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-black uppercase tracking-[0.3em] text-[10px]">No Question Modules Found</p>
                  <p className="text-xs font-medium mt-2">Select a module type from the top bar to begin</p>
                </div>
              ) : (
                activePage.questions.map((q, qIdx) => (
                  <div 
                    key={q.id}
                    className="group relative bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-8 hover:border-indigo-500/40 transition-all duration-500 shadow-xl"
                  >
                    {/* Module Handle */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                       <button className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                         <ChevronUp className="w-3.5 h-3.5" />
                       </button>
                       <div className="w-6 h-10 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-600 cursor-grab active:cursor-grabbing">
                         <Move className="w-3 h-3" />
                       </div>
                       <button className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                         <ChevronDown className="w-3.5 h-3.5" />
                       </button>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-start justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                               {(() => {
                                 const Icon = QUESTION_TYPES.find(t => t.id === q.question_type)?.icon || HelpCircle;
                                 return <Icon className="w-5 h-5" />;
                               })()}
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{q.question_type} MODULE</p>
                               <span className="text-white font-bold text-xs">Question {qIdx + 1}</span>
                            </div>

                         </div>
                         <div className="flex items-center gap-4">
                            {q.question_type !== 'content_block' && (
                              <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800">
                                 <span className="text-[10px] font-black text-slate-500 uppercase">Weight</span>
                                 <input 
                                   type="number"
                                   value={q.marks}
                                   onChange={(e) => updateQuestion(qIdx, { marks: Number(e.target.value) })}
                                   className="w-8 bg-transparent text-indigo-400 font-black text-sm focus:outline-none"
                                 />
                                 <span className="text-[10px] font-black text-indigo-400 uppercase">Marks</span>
                              </div>
                            )}
                            <button 
                              onClick={() => removeQuestion(qIdx)}
                              className="p-2.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-[1rem] transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </div>

                      {/* Question Textarea */}
                      <div className="space-y-4">
                        <textarea 
                          value={q.question_text}
                          onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })}
                          placeholder={q.question_type === 'content_block' ? "Paste reading passage, poem, or context here..." : "Define the query for the learner... Use $formula$ for Math (e.g. $E=mc^2$)"}
                          rows={q.question_type === 'content_block' ? 8 : 3}
                          className={cn(
                            "w-full bg-[#0a0c10] border border-slate-800/50 rounded-2xl p-6 text-slate-200 placeholder:text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all text-sm leading-relaxed",
                            q.question_type === 'content_block' ? "whitespace-pre-wrap resize-y" : ""
                          )}
                        />
                        
                        {/* Science/Math Preview */}
                        {(q.question_text.includes('$') || q.question_type === 'equation') && (
                          <div className="px-6 py-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                            <p className="text-[9px] font-black text-indigo-400/50 uppercase tracking-[0.2em] mb-2">Scientific Preview</p>
                            <MathContent 
                              content={q.question_text.replace(/\n/g, '<br/>')} 
                              className="text-slate-300 text-sm italic" 
                            />
                          </div>
                        )}
                      </div>

                      {/* Question Hint */}
                      {q.question_type !== 'content_block' && (
                        <div className="flex flex-col gap-3 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                           <div className="flex items-center gap-3">
                             <HelpCircle className="w-4 h-4 text-emerald-500/50" />
                             <input 
                               value={q.hint}
                               onChange={(e) => updateQuestion(qIdx, { hint: e.target.value })}
                               placeholder="Architect a hint for student context... ($formula$ supported)"
                               className="flex-1 bg-transparent text-emerald-400 text-xs font-bold placeholder:text-emerald-900/50 focus:outline-none"
                             />
                           </div>
                           {q.hint.includes('$') && (
                              <div className="pt-2 mt-2 border-t border-emerald-500/10">
                                <MathContent 
                                  content={q.hint} 
                                  className="text-emerald-400/70 text-[10px] italic" 
                                />
                              </div>
                           )}
                        </div>
                      )}


                      {/* Type-specific Options */}
                      {(q.question_type === 'multiple_choice' || q.question_type === 'checkbox') && (
                        <div className="space-y-3 pt-2">
                           {q.options.map((opt: string, optIdx: number) => (
                             <div key={optIdx} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 transition-all">
                               <div className="w-5 h-5 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                                  {q.question_type === 'multiple_choice' ? (
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                  ) : (
                                    <CheckSquare className="w-3 h-3 text-indigo-500" />
                                  )}
                               </div>
                               <input 
                                 value={opt}
                                 onChange={(e) => {
                                   const newOpts = [...q.options];
                                   newOpts[optIdx] = e.target.value;
                                   updateQuestion(qIdx, { options: newOpts });
                                 }}
                                 className="flex-1 bg-slate-900/30 border-b border-slate-800 focus:border-indigo-500/50 py-1 text-sm text-slate-400 focus:outline-none transition-all"
                               />
                               <button 
                                 onClick={() => {
                                   const newOpts = q.options.filter((_: any, i: number) => i !== optIdx);
                                   updateQuestion(qIdx, { options: newOpts });
                                 }}
                                 className="p-1.5 text-slate-700 hover:text-rose-400 transition-colors"
                               >
                                 <X className="w-3 h-3" />
                               </button>
                             </div>
                           ))}
                           <button 
                             onClick={() => updateQuestion(qIdx, { options: [...q.options, `New Option ${q.options.length + 1}`] })}
                             className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-[10px] font-black uppercase tracking-widest mt-2 px-1"
                           >
                              <Plus className="w-3 h-3" /> Add Choice Module
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Page Metadata Footer */}
            <div className="relative group p-6 rounded-[2rem] border border-dashed border-slate-900 bg-slate-950/20 hover:bg-slate-950/40 transition-all mt-12">
              <div className="absolute -top-3 left-8 bg-[#0a0c10] px-3 py-1 rounded-full border border-slate-900">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Page Master Foot</span>
              </div>
              <input 
                value={activePage.footer_text}
                onChange={(e) => {
                  const newPages = [...pages];
                  newPages[activePageIndex].footer_text = e.target.value;
                  setPages(newPages);
                }}
                className="w-full bg-transparent text-xs font-bold text-slate-600 placeholder:text-slate-800 focus:outline-none tracking-widest uppercase text-center"
                placeholder="Enter Page Footer Legend..."
              />
            </div>

          </div>
        </div>
      </div>

      {showPreview && assignment && (
        <div className="fixed inset-0 w-full h-[100dvh] z-[100] bg-black flex flex-col">
          <PremiumWorksheetPlayer 
            assignmentId={assignmentId} 
            studentId="preview-teacher" 
            isPreview={true}
            onClose={() => setShowPreview(false)}
          />
        </div>
      )}
    </div>
  );
}
