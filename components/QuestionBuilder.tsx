"use client";

import React, { useState } from 'react';
import { 
  Plus, Trash2, GripVertical, CheckCircle2, XCircle, 
  Image as ImageIcon, Type, List, CheckSquare, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type QuestionType = 'MCQ' | 'SHORT_ANSWER' | 'TRUE_FALSE' | 'PARAGRAPH';

export interface Question {
  id: string; // temp id
  question_text: string;
  question_type: QuestionType;
  marks: number;
  options?: { label: string; value: string }[]; // For MCQ: A, B, C, D
  correct_answer: string; // "A" or "True" or "keywords"
  order_index: number;
}

interface QuestionBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

export default function QuestionBuilder({ questions, onChange }: QuestionBuilderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const addQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: Math.random().toString(36).substr(2, 9),
      question_text: '',
      question_type: type,
      marks: 1,
      options: type === 'MCQ' ? [
        { label: 'A', value: '' },
        { label: 'B', value: '' },
        { label: 'C', value: '' },
        { label: 'D', value: '' }
      ] : undefined,
      correct_answer: '',
      order_index: questions.length
    };
    onChange([...questions, newQ]);
    setActiveId(newQ.id); // Auto-focus new question
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    if (confirm('Delete this question?')) {
      onChange(questions.filter(q => q.id !== id));
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    
    // Update order indices
    newQuestions.forEach((q, i) => q.order_index = i);
    onChange(newQuestions);
  };

  return (
    <div className="space-y-6">
      {/* Toolbox */}
      <div className="flex flex-wrap gap-2 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
        <span className="text-sm text-slate-400 font-medium mr-2 self-center">Add Question:</span>
        <Button size="sm" variant="outline" onClick={() => addQuestion('MCQ')} className="gap-2">
          <List className="w-4 h-4 text-blue-400" /> MCQ
        </Button>
        <Button size="sm" variant="outline" onClick={() => addQuestion('SHORT_ANSWER')} className="gap-2">
          <Type className="w-4 h-4 text-green-400" /> Short Answer
        </Button>
        <Button size="sm" variant="outline" onClick={() => addQuestion('TRUE_FALSE')} className="gap-2">
          <CheckSquare className="w-4 h-4 text-purple-400" /> True/False
        </Button>
         <Button size="sm" variant="outline" onClick={() => addQuestion('PARAGRAPH')} className="gap-2">
          <FileText className="w-4 h-4 text-amber-400" /> Long Answer
        </Button>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl">
            <p className="text-slate-500">No questions added yet. Click a button above to start.</p>
          </div>
        )}

        {questions.map((q, index) => (
          <div 
            key={q.id} 
            className={cn(
              "group relative bg-slate-800 border rounded-xl transition-all",
              activeId === q.id ? "border-indigo-500 ring-1 ring-indigo-500/50" : "border-slate-700 hover:border-slate-600"
            )}
            onClick={() => setActiveId(q.id)}
          >
            {/* Header / Drag Handle */}
            <div className="flex items-center gap-3 p-3 border-b border-slate-700/50 bg-slate-900/30 rounded-t-xl">
              <div className="cursor-move text-slate-500 hover:text-slate-300">
                <GripVertical className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-500">Q{index + 1}</span>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                {q.question_type}
              </span>
              <div className="flex-1" />
              
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={q.marks} 
                  onChange={(e) => updateQuestion(q.id, { marks: Number(e.target.value) })}
                  className="w-16 h-7 text-xs bg-slate-900 border-slate-700"
                  min={1}
                />
                <span className="text-xs text-slate-400">marks</span>
              </div>

              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7 text-red-400 hover:bg-red-500/20"
                onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Question Text */}
              <div>
                <Label className="text-xs text-slate-400 uppercase font-bold mb-1.5 block">Question Text</Label>
                <Textarea 
                  value={q.question_text}
                  onChange={(e) => updateQuestion(q.id, { question_text: e.target.value })}
                  placeholder="Enter the question here..."
                  className="bg-slate-900 border-slate-700 min-h-[80px]"
                />
              </div>

              {/* Type Specific Fields */}
              {q.question_type === 'MCQ' && (
                <div className="space-y-3">
                  <Label className="text-xs text-slate-400 uppercase font-bold">Options</Label>
                  <div className="grid gap-2">
                    {q.options?.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <div 
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-lg border cursor-pointer transition-all font-bold text-sm",
                            q.correct_answer === opt.label 
                              ? "bg-green-500 border-green-500 text-white" 
                              : "bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700"
                          )}
                          onClick={() => updateQuestion(q.id, { correct_answer: opt.label })}
                          title="Click to mark as correct answer"
                        >
                          {opt.label}
                        </div>
                        <Input 
                          value={opt.value}
                          onChange={(e) => {
                             const newOptions = [...(q.options || [])];
                             newOptions[optIdx].value = e.target.value;
                             updateQuestion(q.id, { options: newOptions });
                          }}
                          placeholder={`Option ${opt.label}`}
                          className="bg-slate-900 border-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {q.question_type === 'TRUE_FALSE' && (
                <div className="flex gap-4">
                    {['True', 'False'].map((val) => (
                        <div 
                            key={val}
                            onClick={() => updateQuestion(q.id, { correct_answer: val })}
                            className={cn(
                                "flex-1 p-3 rounded-xl border text-center cursor-pointer transition-all font-medium",
                                q.correct_answer === val 
                                    ? "bg-green-500/20 border-green-500 text-green-400" 
                                    : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800"
                            )}
                        >
                            {val}
                        </div>
                    ))}
                </div>
              )}

              {(q.question_type === 'SHORT_ANSWER' || q.question_type === 'PARAGRAPH') && (
                <div>
                   <Label className="text-xs text-slate-400 uppercase font-bold mb-1.5 block">
                       {q.question_type === 'PARAGRAPH' ? 'Model Answer / Keywords (Optional)' : 'Correct Answer'}
                   </Label>
                   <Input 
                      value={q.correct_answer}
                      onChange={(e) => updateQuestion(q.id, { correct_answer: e.target.value })}
                      placeholder={q.question_type === 'PARAGRAPH' ? "Key points to look for..." : "Exact answer text"}
                      className="bg-slate-900 border-slate-700"
                   />
                   {q.question_type === 'SHORT_ANSWER' && (
                       <p className="text-xs text-slate-500 mt-1">Exact match will be auto-graded.</p>
                   )}
                </div>
              )}

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
