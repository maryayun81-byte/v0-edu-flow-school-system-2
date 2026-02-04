'use client';

import React, { useState } from 'react';
import { Plus, FileText, Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingActionMenuProps {
  onAddNote: () => void;
  onAddAssignment: () => void;
}

export function FloatingActionMenu({ onAddNote, onAddAssignment }: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 lg:hidden flex flex-col items-end space-y-4">
      
      {/* Overlay to close on click outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity animate-in fade-in" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Menu Items */}
      <div className={cn(
        "flex flex-col items-end space-y-4 transition-all duration-300 ease-out origin-bottom-right z-50",
        isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-0 opacity-0 translate-y-10 pointer-events-none"
      )}>
        <div className="flex items-center gap-3">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg dark:text-white border border-white/20">
            Create Assignment
          </div>
          <button
            onClick={() => handleAction(onAddAssignment)}
            className="w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all border border-white/20"
          >
            <Calendar className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg dark:text-white border border-white/20">
            Add Note
          </div>
          <button
            onClick={() => handleAction(onAddNote)}
            className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full flex items-center justify-center shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all border border-white/20"
          >
            <FileText className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button
        onClick={toggleMenu}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 z-50 border border-white/20 relative",
          isOpen 
            ? "bg-red-500 hover:bg-red-600 rotate-90 text-white" 
            : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white hover:scale-105"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-8 h-8" />}
      </button>
    </div>
  );
}
