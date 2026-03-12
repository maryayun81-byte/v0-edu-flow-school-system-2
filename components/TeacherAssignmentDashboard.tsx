'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BookOpen, Users, Clock, CheckCircle2, XCircle, AlertCircle,
  Eye, FileText, Download, ChevronDown, Filter, Search,
  ArrowLeft, BarChart2, Loader2, Image, Plus, Star, Minus,
  Pen, Square, Circle, Type, Highlighter, Eraser, Check,
  X, Save, Send, MessageSquare, Trophy, TrendingUp, TrendingDown,
  RefreshCw, ZoomIn, ZoomOut, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import EnterpriseAssignmentCreator from './EnterpriseAssignmentCreator';

const supabase = createClient();

type FilterStatus = 'ALL' | 'SUBMITTED' | 'MARKED' | 'NOT_SUBMITTED' | 'LATE';
type MarkerTool = 'pen' | 'highlighter' | 'tick' | 'cross' | 'text' | 'eraser' | 'circle' | 'underline' | 'comment';

interface Assignment {
  id: string;
  title: string;
  class_id: string;
  subject_id: string;
  due_date: string;
  submission_type: string;
  visibility_type: string;
  status: string;
  total_marks: number;
  created_at: string;
  classes?: { name: string };
  subjects?: { name: string };
  _submissionCount?: number;
  _totalRecipients?: number;
}

interface Submission {
  id: string;
  student_id: string;
  assignment_id: string;
  status: string;
  submitted_at: string;
  profiles?: { full_name: string; admission_number: string };
  submission_files?: { id: string; file_name: string; file_url: string; file_type: string }[];
  submission_feedback?: { score: number; strengths: string[]; weaknesses: string[]; is_returned: boolean }[];
}

import * as pdfjsLib from 'pdfjs-dist';

// Try to set workerSrc for pdfjs. We use unpkg or cdnjs as a fallback for the worker.
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface MarkingState {
  score: string;
  strengths: string[];
  weaknesses: string[];
  newStrength: string;
  newWeakness: string;
}

// ─── DIGITAL MARKING CANVAS ─────────────────────────────────────────
function DigitalMarkingCanvas({ imageUrl, onAnnotationsChange }: { imageUrl: string; onAnnotationsChange: (data: any[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [tool, setTool] = useState<MarkerTool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [pdfGenerating, setPdfGenerating] = useState(imageUrl.toLowerCase().endsWith('.pdf'));
  const [finalImageUrl, setFinalImageUrl] = useState(imageUrl);
  const [imgSize, setImgSize] = useState({ w: 800, h: 1100 });

  useEffect(() => {
    let active = true;
    async function initPdf() {
      if (!imageUrl.toLowerCase().endsWith('.pdf')) {
        setFinalImageUrl(imageUrl);
        setPdfGenerating(false);
        return;
      }
      
      try {
        setPdfGenerating(true);
        const loadingTask = pdfjsLib.getDocument(imageUrl);
        const pdf = await loadingTask.promise;
        const numPages = Math.min(pdf.numPages, 5); // Limit to 5 pages to prevent massive canvases
        
        const canvases = [];
        let totalH = 0;
        let maxW = 0;
        
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) await page.render({ canvasContext: ctx, viewport } as any).promise;
          canvases.push(canvas);
          totalH += viewport.height;
          maxW = Math.max(maxW, viewport.width);
        }
        
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = maxW;
        finalCanvas.height = totalH;
        const ctx = finalCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, maxW, totalH);
          let currentY = 0;
          for (const c of canvases) {
            ctx.drawImage(c, (maxW - c.width) / 2, currentY); // center horizontally
            currentY += c.height;
          }
          if (active) {
            setFinalImageUrl(finalCanvas.toDataURL('image/jpeg', 0.8));
          }
        }
      } catch (err) {
        console.error('PDF render error:', err);
      } finally {
        if (active) setPdfGenerating(false);
      }
    }
    initPdf();
    return () => { active = false; };
  }, [imageUrl]);

  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showToolbar, setShowToolbar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    if (window.innerWidth < 1024) setShowToolbar(false);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    startPos.current = pos;
    setIsDrawing(true);

    if (tool === 'tick' || tool === 'cross' || tool === 'text') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.font = `bold ${tool === 'text' ? 18 : 36}px sans-serif`;
      ctx.fillStyle = tool === 'tick' ? '#22c55e' : tool === 'cross' ? '#ef4444' : color;
      ctx.fillText(tool === 'tick' ? '✓' : tool === 'cross' ? '✗' : '...', pos.x - 15, pos.y + 15);
      ctx.restore();
      onAnnotationsChange([{ snapshot: canvas.toDataURL() }]);
      setIsDrawing(false);
      return;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos.current || !startPos.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : tool === 'highlighter' ? `${color}30` : color;
      ctx.lineWidth = tool === 'eraser' ? 20 : tool === 'highlighter' ? 30 : lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastPos.current = pos;
    }
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !startPos.current) {
        setIsDrawing(false);
        return;
    }
    const pos = getPos(e, canvas);

    if (tool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - startPos.current.x, 2) + Math.pow(pos.y - startPos.current.y, 2));
      ctx.beginPath();
      ctx.arc(startPos.current.x, startPos.current.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else if (tool === 'underline') {
      ctx.beginPath();
      ctx.moveTo(startPos.current.x, startPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 1.5;
      ctx.stroke();
    }

    setIsDrawing(false);
    lastPos.current = null;
    startPos.current = null;
    onAnnotationsChange([{ snapshot: canvas.toDataURL() }]);
  };

  const tools: { id: MarkerTool; icon: any; label: string; color?: string }[] = [
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlight' },
    { id: 'tick', icon: Check, label: 'Tick ✓', color: '#22c55e' },
    { id: 'cross', icon: X, label: 'Cross ✗', color: '#ef4444' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'underline', icon: Minus, label: 'Underline' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#000000'];

  return (
    <div className="relative group">
      {/* Billion-Dollar Floating Toolbar */}
      <div className={cn(
        "absolute top-4 left-4 z-20 flex flex-col gap-2 transition-all duration-500",
        !showToolbar && "-translate-x-16 opacity-0 pointer-events-none"
      )}>
        <div className="flex flex-col gap-1.5 p-2 bg-slate-800/95 backdrop-blur-2xl rounded-[2rem] border border-slate-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); if (isMobile) setShowToolbar(false); }}
              title={t.label}
              className={cn(
                "p-3.5 rounded-[1.25rem] transition-all duration-300",
                tool === t.id ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-110' : 'hover:bg-slate-700/50 text-slate-400 hover:text-white'
              )}
            >
              <t.icon className="w-5 h-5" />
            </button>
          ))}
          <div className="h-px bg-slate-700/50 mx-3 my-1" />
          <div className="grid grid-cols-2 gap-2 p-1">
            {colors.slice(0, 4).map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn("w-6 h-6 rounded-full border-2 transition-all duration-300", color === c ? 'border-white scale-125 shadow-lg' : 'border-transparent hover:scale-110')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 p-2 bg-slate-800/95 backdrop-blur-2xl rounded-2xl border border-slate-700/50 shadow-2xl">
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-3 hover:bg-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="text-[10px] font-black text-center text-slate-500 py-1 tracking-tighter">{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-3 hover:bg-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modern Toolbar Toggle */}
      <button
        onClick={() => setShowToolbar(!showToolbar)}
        className="absolute top-4 left-4 z-30 p-4 bg-indigo-600 text-white rounded-2xl shadow-2xl lg:hidden hover:bg-indigo-700 active:scale-95 transition-all"
      >
        {showToolbar ? <X className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
      </button>

      {/* High-Performance Canvas Surface */}
      <div className="relative overflow-auto max-h-[75vh] bg-[#0c111d] rounded-[2.5rem] border border-slate-800/50 shadow-inner scrollbar-hide">
        <div 
          className="transition-transform duration-300 ease-out origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="relative flex justify-center min-h-[500px]">
            {pdfGenerating ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-indigo-400">
                <Loader2 className="w-12 h-12 animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Rendering PDF...</p>
              </div>
            ) : (
              <>
                <img 
                  ref={imageRef}
                  src={finalImageUrl} 
                  alt="Submission" 
                  className="max-w-none pointer-events-none select-none" 
                  style={{ display: 'block' }} 
                  onLoad={(e) => {
                    setImgSize({
                      w: e.currentTarget.naturalWidth,
                      h: e.currentTarget.naturalHeight
                    });
                  }}
                />
                <canvas
                  ref={canvasRef}
                  width={imgSize.w}
                  height={imgSize.h}
                  className="absolute inset-0 cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex justify-center">
        <div className="bg-slate-800/40 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700/50">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            {isMobile ? 'Touch to Draw · Dual Finger Scroll' : 'Precision Drawing Mode · Scale-Aware Vectors'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MARKING PANEL ──────────────────────────────────────────────────
function MarkingPanel({
  submission,
  assignment,
  onClose,
  onSaved,
}: {
  submission: Submission;
  assignment: Assignment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [marking, setMarking] = useState<MarkingState>({
    score: '',
    strengths: [],
    weaknesses: [],
    newStrength: '',
    newWeakness: '',
  });
  const [activeFile, setActiveFile] = useState(0);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fb = submission.submission_feedback?.[0];
    if (fb) {
      setMarking({
        score: String(fb.score ?? ''),
        strengths: fb.strengths || [],
        weaknesses: fb.weaknesses || [],
        newStrength: '',
        newWeakness: '',
      });
    }
  }, [submission]);

  const files = submission.submission_files || [];

  async function saveMarking(returnToStudent: boolean) {
    setSaving(true);
    try {
      // Save annotations
      if (annotations.length > 0) {
        await supabase.from('submission_annotations')
          .upsert({ submission_id: submission.id, annotation_data: annotations, updated_at: new Date().toISOString() }, { onConflict: 'submission_id' });
      }

      // Save feedback
      const feedbackPayload = {
        submission_id: submission.id,
        score: marking.score ? parseFloat(marking.score) : null,
        strengths: marking.strengths,
        weaknesses: marking.weaknesses,
        is_returned: returnToStudent,
        returned_at: returnToStudent ? new Date().toISOString() : null,
      };
      await supabase.from('submission_feedback')
        .upsert(feedbackPayload, { onConflict: 'submission_id' });

      // Update submission status
      const newStatus = returnToStudent ? 'RETURNED' : 'MARKED';
      await supabase.from('student_submissions').update({ status: newStatus }).eq('id', submission.id);

      // Notify student if returning
      if (returnToStudent) {
        await supabase.from('notifications').insert({
          type: 'info',
          title: 'Assignment Marked & Returned',
          message: `Your assignment "${assignment.title}" has been marked. Score: ${marking.score}/${assignment.total_marks}`,
          target_user_id: submission.student_id,
          audience: 'specific',
        });
      }

      toast.success(returnToStudent ? '🎉 Marked and returned to student!' : '✅ Marking saved!');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save marking');
    } finally {
      setSaving(false);
    }
  }

  const currentFile = files[activeFile];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Cinematic Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <button 
            onClick={onClose} 
            className="group flex items-center gap-2 text-slate-500 hover:text-indigo-400 transition-all mb-4 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Control Center / Submission Stream
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-black text-2xl">
              {submission.profiles?.full_name?.charAt(0)}
            </div>
            <div>
              <h3 className="text-4xl font-black text-white tracking-tighter uppercase">{submission.profiles?.full_name}</h3>
              <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase mt-1">
                Asset ID: {submission.profiles?.admission_number || 'UNKNOWN'} · Received {submission.submitted_at ? format(new Date(submission.submitted_at), 'MMM d, h:mm a') : 'Awaiting Transmission'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => saveMarking(false)}
            disabled={saving}
            className="flex items-center gap-3 px-8 py-4 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-700 hover:border-slate-500 transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sync Progress
          </button>
          <button
            onClick={() => saveMarking(true)}
            disabled={saving}
            className="group relative flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_20px_40px_rgba(79,70,229,0.3)] border border-indigo-400/20 transition-all active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            Finalize & Return
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-[1fr_420px] gap-8">
        {/* Cinematic File Viewer */}
        <div className="space-y-6 md:min-w-[400px]">
          {files.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {files.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFile(i)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                    activeFile === i 
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:text-white hover:border-slate-500'
                  )}
                >
                  {f.file_type === 'PHOTO' ? <Image className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  {f.file_name}
                </button>
              ))}
            </div>
          )}

          <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-700/30 overflow-hidden shadow-2xl relative min-h-[600px] flex flex-col items-center justify-center p-8">
            {currentFile ? (
              currentFile.file_name.match(/\.(jpg|jpeg|png|webp|pdf)$/i) ? (
                <div className="w-full h-full animate-in zoom-in-95 duration-500 overflow-auto">
                  <DigitalMarkingCanvas
                    imageUrl={currentFile.file_url}
                    onAnnotationsChange={setAnnotations}
                  />
                </div>
              ) : (
                <div className="text-center space-y-6 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mx-auto">
                    <FileText className="w-12 h-12 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white tracking-tight uppercase">{currentFile.file_name}</p>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 px-12 leading-relaxed">External Asset Detected. Deep-link synchronization required for evaluation.</p>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const match = currentFile.file_url.match(/enterprise-assignments\/(.+)$/);
                        if (match && match[1]) {
                          const { data } = await supabase.storage.from('enterprise-assignments').createSignedUrl(match[1], 3600);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                            return;
                          }
                        }
                      } catch (err) {}
                      window.open(currentFile.file_url, '_blank');
                    }}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 group"
                  >
                    <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                    Secure Access Stream
                  </button>
                </div>
              )
            ) : (
              <div className="text-center space-y-4 opacity-30">
                <Users className="w-16 h-16 mx-auto" />
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Zero Assets Transmitted</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Intelligence Panel: Score + Feedback */}
        <div className="space-y-6">
          {/* Performance Metric Section */}
          <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-700/30 p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Trophy className="w-24 h-24" />
            </div>
            <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6">Execution Score</h4>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32">
                <input
                  type="number"
                  value={marking.score}
                  onChange={e => setMarking(m => ({ ...m, score: e.target.value }))}
                  placeholder="0"
                  min={0}
                  max={assignment.total_marks}
                  className="w-full h-full bg-slate-900/50 border-2 border-indigo-500/30 group-hover:border-indigo-500/60 rounded-[2rem] text-4xl font-black text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-center transition-all"
                />
              </div>
              <div className="flex-1">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Target Threshold</p>
                <p className="text-3xl font-black text-white mt-1">/ {assignment.total_marks}</p>
                {marking.score && (
                  <div className={cn(
                    "mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border",
                    Number(marking.score) / assignment.total_marks >= 0.5 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", Number(marking.score) / assignment.total_marks >= 0.5 ? 'bg-emerald-400' : 'bg-rose-400')} />
                    {Math.round((Number(marking.score) / assignment.total_marks) * 100)}% PERFORMANCE
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback Matrix: Strengths */}
          <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-700/30 p-8 shadow-2xl">
            <h4 className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Strategic Strengths
            </h4>
            <div className="space-y-3 mb-6">
              {marking.strengths.map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800/30 border border-slate-700/30 p-3 rounded-xl group animate-in slide-in-from-right-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-300 text-xs font-bold leading-relaxed flex-1">{s}</span>
                  <button onClick={() => setMarking(m => ({ ...m, strengths: m.strengths.filter((_, j) => j !== i) }))} className="text-slate-600 hover:text-rose-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {marking.strengths.length === 0 && <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center py-4">No strengths identified</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={marking.newStrength}
                onChange={e => setMarking(m => ({ ...m, newStrength: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && marking.newStrength.trim()) {
                    setMarking(m => ({ ...m, strengths: [...m.strengths, m.newStrength.trim()], newStrength: '' }));
                  }
                }}
                placeholder="Identify positive trait..."
                className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-bold placeholder:text-slate-700"
              />
              <button
                onClick={() => {
                  if (marking.newStrength.trim()) {
                    setMarking(m => ({ ...m, strengths: [...m.strengths, m.newStrength.trim()], newStrength: '' }));
                  }
                }}
                className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all border border-emerald-500/20 active:scale-90"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Feedback Matrix: Improvement Areas */}
          <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-700/30 p-8 shadow-2xl">
            <h4 className="text-rose-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Growth Opportunity
            </h4>
            <div className="space-y-3 mb-6">
              {marking.weaknesses.map((w, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800/30 border border-slate-700/30 p-3 rounded-xl group animate-in slide-in-from-right-2">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-slate-300 text-xs font-bold leading-relaxed flex-1">{w}</span>
                  <button onClick={() => setMarking(m => ({ ...m, weaknesses: m.weaknesses.filter((_, j) => j !== i) }))} className="text-slate-600 hover:text-rose-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {marking.weaknesses.length === 0 && <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center py-4">No critical pivots required</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={marking.newWeakness}
                onChange={e => setMarking(m => ({ ...m, newWeakness: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && marking.newWeakness.trim()) {
                    setMarking(m => ({ ...m, weaknesses: [...m.weaknesses, m.newWeakness.trim()], newWeakness: '' }));
                  }
                }}
                placeholder="Identify growth pivot..."
                className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all font-bold placeholder:text-slate-700"
              />
              <button
                onClick={() => {
                  if (marking.newWeakness.trim()) {
                    setMarking(m => ({ ...m, weaknesses: [...m.weaknesses, m.newWeakness.trim()], newWeakness: '' }));
                  }
                }}
                className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all border border-rose-500/20 active:scale-90"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SUBMISSIONS TABLE ────────────────────────────────────────────────
function SubmissionsTable({ assignment, onBack }: { assignment: Assignment; onBack: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [search, setSearch] = useState('');
  const [markingSubmission, setMarkingSubmission] = useState<Submission | null>(null);

  interface Student { id: string; full_name: string; admission_number?: string }

  useEffect(() => { fetchData(); }, [assignment.id]);

  async function fetchData() {
    setLoading(true);
    try {
      // Get all recipients
      const { data: recipients } = await supabase
        .from('assignment_recipients')
        .select('student_id, profiles!inner(id, full_name, admission_number)')
        .eq('assignment_id', assignment.id);

      if (recipients && recipients.length > 0) {
        setAllStudents(recipients.map((r: any) => ({
          id: r.profiles.id,
          full_name: r.profiles.full_name,
          admission_number: r.profiles.admission_number,
        })));
      } else {
        // Robust Fallback: get class students from both student_classes AND profiles text fallback
        const { data: assignmentData } = await supabase
          .from('assignments')
          .select('class_id, classes(name)')
          .eq('id', assignment.id)
          .single();

        if (assignmentData) {
          const className = (assignmentData.classes as any)?.name;
          const { data: classStudents } = await supabase
            .from('student_classes')
            .select('student_id')
            .eq('class_id', assignmentData.class_id);
          
          const studentIds = classStudents?.map((s: { student_id: string }) => s.student_id) || [];
          
          let query = supabase
            .from('profiles')
            .select('id, full_name, admission_number')
            .eq('role', 'student');

          if (studentIds.length > 0) {
            if (className) {
              query = query.or(`id.in.(${studentIds.join(',')}),form_class.eq."${className}"`);
            } else {
              query = query.in('id', studentIds);
            }
          } else if (className) {
            query = query.eq('form_class', className);
          } else {
            // Cannot find students if no class linkage
            setAllStudents([]);
            setLoading(false);
            return;
          }

          const { data: finalStudents } = await query;
          if (finalStudents) {
            setAllStudents(finalStudents);
          }
        }
      }

      // Get submissions
      const { data: subs } = await supabase
        .from('student_submissions')
        .select(`
          *,
          profiles!inner(full_name, admission_number),
          submission_files(id, file_name, file_url, file_type),
          submission_feedback(score, strengths, weaknesses, is_returned)
        `)
        .eq('assignment_id', assignment.id)
        .order('submitted_at', { ascending: false });

      if (subs) setSubmissions(subs as Submission[]);
    } finally {
      setLoading(false);
    }
  }

  if (markingSubmission) {
    return (
      <MarkingPanel
        submission={markingSubmission}
        assignment={assignment}
        onClose={() => setMarkingSubmission(null)}
        onSaved={() => { setMarkingSubmission(null); fetchData(); }}
      />
    );
  }

  const submissionMap = new Map(submissions.map(s => [s.student_id, s]));
  const dueDate = new Date(assignment.due_date);

  const rows = allStudents
    .map(student => {
      const sub = submissionMap.get(student.id);
      const isLate = sub ? new Date(sub.submitted_at) > dueDate : false;
      const isMarked = sub?.status === 'MARKED' || sub?.status === 'RETURNED';
      const displayStatus = !sub ? 'NOT_SUBMITTED' : isLate ? 'LATE' : sub.status;
      return { student, sub, isLate, isMarked, displayStatus };
    })
    .filter(row => {
      if (filter !== 'ALL' && row.displayStatus !== filter) return false;
      if (search && !row.student.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

  const counts = {
    submitted: submissions.length,
    marked: submissions.filter(s => s.status === 'MARKED' || s.status === 'RETURNED').length,
    total: allStudents.length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All Assignments
        </button>
        <span className="text-slate-700">/</span>
        <h3 className="text-white font-semibold truncate">{assignment.title}</h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Submitted', value: counts.submitted, total: counts.total, color: 'indigo' },
          { label: 'Marked', value: counts.marked, total: counts.submitted, color: 'amber' },
          { label: 'Pending Mark', value: counts.submitted - counts.marked, total: counts.submitted, color: 'red' },
        ].map(({ label, value, total, color }) => (
          <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-xl p-4`}>
            <p className="text-slate-400 text-xs">{label}</p>
            <p className={`text-2xl font-bold text-${color}-400`}>{value}<span className="text-sm text-slate-500 font-normal">/{total}</span></p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['ALL', 'SUBMITTED', 'MARKED', 'NOT_SUBMITTED', 'LATE'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-3 py-2 rounded-xl text-xs font-medium transition-colors", filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700')}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Billion-Dollar Submissions Table */}
      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-12 h-12 text-indigo-400 animate-spin" /></div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-700/30 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/30 bg-slate-800/30">
                  {['Student', 'Vitals', 'Submission Metrics', 'Evaluation', 'Command'].map(h => (
                    <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {rows.map(({ student, sub, isLate, isMarked, displayStatus }) => {
                  const fb = sub?.submission_feedback?.[0];
                  return (
                    <tr key={student.id} className="group hover:bg-slate-800/40 transition-all duration-300">
                      <td className="px-8 py-6">
                        <p className="text-white font-black tracking-tight text-lg group-hover:text-indigo-400 transition-colors uppercase">{student.full_name}</p>
                        <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mt-1">Admission: {student.admission_number || 'N/A'}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className={cn(
                          "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border",
                          displayStatus === 'NOT_SUBMITTED' ? 'bg-slate-800/50 text-slate-500 border-slate-700/50' :
                          displayStatus === 'LATE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          displayStatus === 'MARKED' || displayStatus === 'RETURNED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        )}>
                          <span className={cn("w-2 h-2 rounded-full animate-pulse", 
                            displayStatus === 'NOT_SUBMITTED' ? 'bg-slate-600' :
                            displayStatus === 'LATE' ? 'bg-rose-400' :
                            isMarked ? 'bg-emerald-400' : 'bg-indigo-400'
                          )} />
                          {displayStatus.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-slate-400 font-bold text-xs uppercase tracking-wider">
                        {sub?.submitted_at ? (
                          <div className="flex flex-col">
                            <span>{format(new Date(sub.submitted_at), 'MMM d, h:mm a')}</span>
                            {isLate && <span className="text-rose-400 text-[9px] mt-1 font-black">LATE SUBMISSION</span>}
                          </div>
                        ) : <span className="opacity-30">—</span>}
                      </td>
                      <td className="px-8 py-6">
                        {fb?.score != null ? (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                              <Trophy className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="text-xl font-black text-white">{fb.score}<span className="text-slate-500 font-normal">/{assignment.total_marks}</span></p>
                              <p className="text-[9px] font-bold text-slate-500 tracking-tighter">{Math.round((fb.score / assignment.total_marks) * 100)}% SUCCESS RATE</p>
                            </div>
                          </div>
                        ) : <span className="text-slate-700 font-black">UNGRADED</span>}
                      </td>
                      <td className="px-8 py-6 text-right">
                        {sub ? (
                          <button
                            onClick={() => setMarkingSubmission(sub)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 hover:border-slate-500 transition-all active:scale-95 flex items-center gap-3 ml-auto"
                          >
                            <Eye className="w-4 h-4" />
                            {isMarked ? 'Review Profile' : 'Evaluate Work'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 justify-end text-slate-700">
                             <span className="text-[10px] font-black uppercase tracking-widest">Awaiting File</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-24 text-center">
                      <div className="group inline-block p-12 bg-slate-800/30 rounded-[3rem] border border-slate-700/30 backdrop-blur-xl">
                        <Users className="w-16 h-16 text-slate-600 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" />
                        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs">Zero Recipients Detected</p>
                        <p className="text-slate-600 text-[10px] mt-2 font-bold uppercase tracking-widest">Verify Class Population in the Creator</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN TEACHER ASSIGNMENT DASHBOARD ──────────────────────────────
export default function TeacherAssignmentDashboard({ userId }: { userId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');

  useEffect(() => { fetchAssignments(); }, [userId]);

  async function fetchAssignments() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('assignments')
        .select(`
          *,
          classes(name),
          subjects(name)
        `)
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false });

      if (data) {
        // Enrich with submission counts
        const enriched = await Promise.all(data.map(async (a: any) => {
          const [{ count: subCount }, { count: recipCount }] = await Promise.all([
            supabase.from('student_submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', a.id),
            supabase.from('assignment_recipients').select('*', { count: 'exact', head: true }).eq('assignment_id', a.id),
          ]);
          return { ...a, _submissionCount: subCount || 0, _totalRecipients: recipCount || 0 };
        }));
        setAssignments(enriched);
      }
    } finally {
      setLoading(false);
    }
  }

  if (viewingAssignment) {
    return <SubmissionsTable assignment={viewingAssignment} onBack={() => { setViewingAssignment(null); fetchAssignments(); }} />;
  }

  const filtered = assignments.filter(a => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSubmissions = assignments.reduce((s, a) => s + (a._submissionCount || 0), 0);
  const totalPublished = assignments.filter(a => a.status === 'PUBLISHED').length;

  return (
    <div className="space-y-6">
      {showCreator && (
        <EnterpriseAssignmentCreator
          userId={userId}
          onClose={() => setShowCreator(false)}
          onSuccess={fetchAssignments}
        />
      )}

      {/* Premium Performance Insights Panel */}
      {!loading && !viewingAssignment && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="bg-slate-800/40 backdrop-blur-3xl border border-slate-700/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group hover:bg-slate-800/60 transition-all duration-500">
            <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
              <Users className="w-24 h-24" />
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Live Roster</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-4xl font-black text-white">{assignments.reduce((sum, a) => Math.max(sum, a._totalRecipients || 0), 0)}</p>
              <p className="text-slate-500 text-sm font-bold">Students</p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[10px] text-emerald-400 font-black bg-emerald-500/10 w-fit px-3 py-1.5 rounded-full border border-emerald-500/20">
              <TrendingUp className="w-3 h-3" /> ACTIVE TRACKING
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-3xl border border-slate-700/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group hover:bg-slate-800/60 transition-all duration-500">
            <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
              <CheckCircle2 className="w-24 h-24" />
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Efficiency</p>
            <p className="text-4xl font-black text-white mt-2">
              {assignments.length > 0 ? Math.round((totalSubmissions / assignments.reduce((s, a) => s + (a._totalRecipients || 0), 0)) * 100) || 0 : 0}%
            </p>
            <div className="mt-6 w-full bg-slate-900/50 h-2 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${assignments.length > 0 ? (totalSubmissions / assignments.reduce((s, a) => s + (a._totalRecipients || 0), 0)) * 100 : 0}%` }} 
              />
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-3xl border border-slate-700/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group hover:bg-slate-800/60 transition-all duration-500">
            <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
              <Trophy className="w-24 h-24" />
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Class Score</p>
            <p className="text-4xl font-black text-emerald-400 mt-2">74.2%</p>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest opacity-60">High Performance Mode</p>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-3xl border border-slate-700/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group hover:bg-slate-800/60 transition-all duration-500">
            <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
              <AlertCircle className="w-24 h-24" />
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Marking Queue</p>
            <p className="text-4xl font-black text-amber-500 mt-2">
              {totalSubmissions - assignments.reduce((s, a) => s + (a.status === 'MARKED' || a.status === 'RETURNED' ? (a._submissionCount || 0) : 0), 0)}
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest opacity-60">Pending Evaluation</p>
          </div>
        </div>
      )}

      {/* Modern Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-5xl font-black text-white tracking-tighter">Command Center</h2>
          <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-[0.3em] flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {totalPublished} Active Sessions · {totalSubmissions} Managed Assets
          </p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="group relative flex items-center gap-4 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black shadow-[0_20px_40px_rgba(79,70,229,0.3)] transition-all duration-300 hover:scale-[1.05] active:scale-95"
        >
          <div className="absolute inset-0 rounded-[1.5rem] bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <Plus className="w-6 h-6" />
          Create New Assignment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assignments..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-colors", statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white')}
            >
              {s}
            </button>
          ))}
        </div>
        <button onClick={fetchAssignments} className="p-2.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white border border-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>



      {/* Assignment cards */}
      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-12 h-12 text-indigo-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] border border-slate-700/30 shadow-2xl">
          <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mx-auto mb-6">
            <BookOpen className="w-12 h-12 text-indigo-400" />
          </div>
          <p className="text-white text-xl font-black tracking-tight uppercase">Strategic Vacuum Detected</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 px-12 leading-relaxed">No assignments currently managed. Initialize your first academic session to begin tracking.</p>
          <button onClick={() => setShowCreator(true)} className="mt-8 group relative flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg mx-auto transition-all active:scale-95 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <Plus className="w-4 h-4" />
            Initialize Assignment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filtered.map(assignment => {
            const isOver = new Date(assignment.due_date) < new Date();
            const subRate = assignment._totalRecipients ? Math.round(((assignment._submissionCount || 0) / assignment._totalRecipients) * 100) : 0;
            return (
              <div
                key={assignment.id}
                className="group relative bg-slate-900/40 backdrop-blur-3xl border border-slate-700/30 rounded-[2.5rem] p-8 hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all duration-500 cursor-pointer shadow-2xl overflow-hidden"
                onClick={() => setViewingAssignment(assignment)}
              >
                {/* Status Indicator */}
                <div className="absolute top-0 right-0 p-8">
                   <div className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border",
                        assignment.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", assignment.status === 'PUBLISHED' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
                        {assignment.status}
                      </div>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 text-xs font-black">
                        {assignment.subjects?.name?.charAt(0)}
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{assignment.submission_type} Asset</span>
                      {isOver && assignment.status === 'PUBLISHED' && (
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-500/20">Status: Terminal</span>
                      )}
                    </div>
                    
                    <h3 className="text-3xl font-black text-white tracking-tighter group-hover:text-indigo-400 transition-all duration-300 uppercase">{assignment.title}</h3>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">{assignment.classes?.name} Cohort</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">{assignment.subjects?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className={cn("w-4 h-4", isOver ? 'text-rose-400' : 'text-slate-500')} />
                        <span className={cn("text-[11px] font-black uppercase tracking-widest", isOver ? 'text-rose-400' : 'text-slate-400')}>
                          {isOver ? 'EXPIRED' : 'DUE'} • {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-12 shrink-0 bg-slate-800/30 p-8 rounded-[2rem] border border-slate-700/20 group-hover:bg-slate-800/50 transition-all duration-500">
                    <div className="text-center">
                      <p className="text-4xl font-black text-indigo-400 tracking-tighter">{assignment._submissionCount || 0}</p>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Transmitted</p>
                    </div>
                    
                    <div className="h-12 w-px bg-slate-700/50" />

                    {(assignment._totalRecipients || 0) > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 -rotate-90 drop-shadow-lg" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.91" fill="none" stroke="currentColor" className="text-slate-900" strokeWidth="4" />
                            <circle
                              cx="18" cy="18" r="15.91" fill="none"
                              stroke={subRate >= 70 ? '#10b981' : subRate >= 40 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="4"
                              strokeDasharray={`${subRate} 100`}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">{subRate}%</span>
                        </div>
                        <div className="text-left">
                          <p className="text-white text-sm font-black tracking-tight">{assignment._totalRecipients} TOTAL</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Roster Quota</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                         <div className="w-12 h-12 rounded-full bg-slate-900/50 flex items-center justify-center border border-slate-700/30">
                            <AlertCircle className="w-5 h-5 text-slate-600" />
                         </div>
                         <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-2">Zero Roster</p>
                      </div>
                    )}
                    
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500 text-indigo-400">
                      <Eye className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
