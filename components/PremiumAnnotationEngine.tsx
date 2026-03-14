'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import { 
  ChevronLeft, ChevronRight, Pen, Highlighter, 
  Check, X, Type, Eraser, RotateCcw, RotateCw, 
  Save, Download, ZoomIn, ZoomOut, Circle, 
  Minus, Layers, Trash2, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MarkerTool = 'pen' | 'highlighter' | 'tick' | 'cross' | 'text' | 'eraser' | 'circle' | 'underline' | 'comment';

export interface Annotation {
  id: string;
  type: MarkerTool;
  points?: { x: number; y: number }[];
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  text?: string;
}

interface Props {
  imageUrl?: string;
  questionContext?: { text: string; answer: string };
  initialAnnotations?: Annotation[];
  onSave: (annotations: Annotation[]) => void;
  readOnly?: boolean;
}

export default function PremiumAnnotationEngine({ 
  imageUrl, 
  questionContext,
  initialAnnotations = [], 
  onSave,
  readOnly = false 
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<MarkerTool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentComment, setCurrentComment] = useState('');
  const [pendingAnnotation, setPendingAnnotation] = useState<any>(null);

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 1100,
      backgroundColor: '#ffffff'
    });

    fabricCanvasRef.current = canvas;

    // Handle object creation to prompt for comments
    canvas.on('path:created', (options: any) => {
      const path = options.path;
      path.set({
        id: Math.random().toString(36).substr(2, 9),
        comment: ''
      });
      setPendingAnnotation(path);
      setShowCommentModal(true);
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Load Background Image or Question Context
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (imageUrl) {
      fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img: any) => {
        canvas.setDimensions({ width: img.width, height: img.height });
        canvas.backgroundImage = img;
        canvas.renderAll();
        setImageLoaded(true);
        
        // Load initial annotations if any
        if (initialAnnotations.length > 0) {
          // Here we would convert serializable annotations back to fabric objects
          // For simplicity in this step, we focus on new creation
        }
      }).catch((err: any) => {
        console.error("Failed to load background image:", err);
        canvas.setDimensions({ width: 800, height: 1100 });
        setImageLoaded(true);
      });
    } else if (questionContext) {
      canvas.setDimensions({ width: 800, height: 800 });
      
      const qText = new fabric.Textbox("Question:\n" + questionContext.text, {
        left: 50,
        top: 50,
        width: 700,
        fontSize: 22,
        fontWeight: 'bold',
        fill: '#1e293b',
        selectable: false,
        evented: false,
      });
      canvas.add(qText);

      const aText = new fabric.Textbox("Student's Response:\n" + (questionContext.answer || "No response provided."), {
        left: 50,
        top: (qText.top || 50) + qText.getScaledHeight() + 40,
        width: 700,
        fontSize: 18,
        fill: '#334155',
        selectable: false,
        evented: false,
      });
      canvas.add(aText);

      canvas.renderAll();
      setImageLoaded(true);
    } else {
      canvas.setDimensions({ width: 800, height: 1100 });
      setImageLoaded(true);
    }
  }, [imageUrl, questionContext]);

  // tool effect
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = tool === 'pen' || tool === 'highlighter';
    if (canvas.isDrawingMode) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = strokeWidth;
      if (tool === 'highlighter') {
        canvas.freeDrawingBrush.color = color + '55'; // semi-transparent
      }
    } else {
      canvas.defaultCursor = 'crosshair';
    }
  }, [tool, color, strokeWidth]);

  const addStaticShape = (type: MarkerTool) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let shape: any;
    const center = canvas.getVpCenter();

    if (type === 'tick') {
      shape = new fabric.Polyline([
        { x: 0, y: 10 }, { x: 5, y: 15 }, { x: 15, y: 0 }
      ], {
        left: center.x,
        top: center.y,
        stroke: '#10b981',
        strokeWidth: 4,
        fill: 'transparent'
      });
    } else if (type === 'cross') {
      shape = new fabric.Group([
        new fabric.Line([0, 0, 15, 15], { stroke: '#ef4444', strokeWidth: 4 }),
        new fabric.Line([15, 0, 0, 15], { stroke: '#ef4444', strokeWidth: 4 })
      ], {
        left: center.x,
        top: center.y
      });
    } else if (type === 'circle') {
      shape = new fabric.Circle({
        left: center.x,
        top: center.y,
        radius: 20,
        stroke: color,
        strokeWidth: strokeWidth,
        fill: 'transparent'
      });
    }

    if (shape) {
      shape.set({ id: Math.random().toString(36).substr(2, 9), comment: '' });
      canvas.add(shape);
      canvas.setActiveObject(shape);
      setPendingAnnotation(shape);
      setShowCommentModal(true);
    }
  };

  const handleSaveComment = () => {
    if (pendingAnnotation) {
      pendingAnnotation.set('comment', currentComment);
      fabricCanvasRef.current?.renderAll();
    }
    setShowCommentModal(false);
    setCurrentComment('');
    setPendingAnnotation(null);
  };

  const serializeAnnotations = (): Annotation[] => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return [];
    
    return canvas.getObjects().map((obj: any) => ({
      id: obj.id,
      type: obj.type as any,
      x: obj.left,
      y: obj.top,
      width: obj.width,
      height: obj.height,
      color: obj.stroke || obj.fill,
      strokeWidth: obj.strokeWidth || 1,
      text: obj.comment
    }));
  };

  const undo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1]);
    }
  };

  const clear = () => {
    fabricCanvasRef.current?.clear();
    // re-load background
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0c10]">
      {/* ── TOOLBAR ── */}
      <div className="h-16 bg-[#0f1117] border-b border-white/5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className="flex items-center bg-slate-900 border border-white/5 rounded-xl p-1 gap-1">
              {(['pen', 'highlighter', 'tick', 'cross', 'text', 'circle', 'underline'] as MarkerTool[]).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setTool(t);
                    if (['tick', 'cross', 'circle'].includes(t)) addStaticShape(t);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    tool === t ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-white"
                  )}
                >
                   {t === 'pen' && <Pen className="w-4 h-4" />}
                   {t === 'highlighter' && <Highlighter className="w-4 h-4" />}
                   {t === 'tick' && <Check className="w-4 h-4" />}
                   {t === 'cross' && <X className="w-4 h-4" />}
                   {t === 'text' && <Type className="w-4 h-4" />}
                   {t === 'circle' && <Circle className="w-4 h-4" />}
                   {t === 'underline' && <Minus className="w-4 h-4" />}
                </button>
              ))}
           </div>
           
           <div className="h-8 w-px bg-white/5 mx-2" />
           
           <div className="flex items-center gap-2 bg-slate-900 border border-white/5 rounded-xl p-1">
              {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#ffffff'].map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    color === c ? "border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
           </div>
        </div>

        <div className="flex items-center gap-3">
           <button onClick={undo} className="p-2.5 bg-slate-900 border border-white/5 text-slate-400 hover:text-white rounded-xl transition-all">
              <RotateCcw className="w-4 h-4" />
           </button>
           <button onClick={clear} className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-all">
              <Trash2 className="w-4 h-4" />
           </button>
           <button 
             onClick={() => onSave(serializeAnnotations())}
             className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-indigo-500/20"
           >
              <Save className="w-4 h-4" /> Save Markings
           </button>
        </div>
      </div>

      {/* ── CANVAS AREA ── */}
      <div className="flex-1 overflow-auto bg-[#050505] p-12 flex justify-center custom-scrollbar" ref={containerRef}>
        <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5 rounded-lg overflow-hidden h-fit bg-white">
           <canvas ref={canvasRef} />
           {!imageLoaded && (
             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-indigo-400">
                <div className="w-12 h-12 border-4 border-indigo-400/20 border-t-indigo-400 rounded-full animate-spin" />
                <p className="font-black uppercase tracking-widest text-xs">Scanning Component...</p>
             </div>
           )}
        </div>
      </div>

      {/* ── COMMENT MODAL ── */}
      {showCommentModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1a1d24] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> Add Mark Comment
            </h3>
            <textarea
              autoFocus
              value={currentComment}
              onChange={(e) => setCurrentComment(e.target.value)}
              placeholder="e.g., Good logic here, but watch the signs..."
              className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none mb-4 min-h-[100px]"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCommentModal(false)}
                className="flex-1 py-3 px-4 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all"
              >
                Skip
              </button>
              <button 
                onClick={handleSaveComment}
                className="flex-1 py-3 px-4 bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
              >
                Attach Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING CONTROLS ── */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#0f1117]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center gap-6 z-50">
          <div className="flex items-center gap-4">
             <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="text-slate-400 hover:text-white transition-colors">
                <ZoomOut className="w-4 h-4" />
             </button>
             <span className="text-[10px] font-black text-white uppercase tracking-widest w-12 text-center">
                {Math.round(zoom * 100)}%
             </span>
             <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="text-slate-400 hover:text-white transition-colors">
                <ZoomIn className="w-4 h-4" />
             </button>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-3">
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Weight</span>
             <input 
               type="range" min="1" max="20" 
               value={strokeWidth}
               onChange={(e) => setStrokeWidth(Number(e.target.value))}
               className="w-24 accent-indigo-500" 
             />
          </div>
      </div>
    </div>
  );
}
