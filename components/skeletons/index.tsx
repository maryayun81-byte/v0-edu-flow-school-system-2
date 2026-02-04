"use client";

import React from "react";

export function MessageListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-fade-in">
          {/* Avatar */}
          <div className="skeleton skeleton-avatar w-12 h-12 flex-shrink-0" />
          
          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="skeleton skeleton-text w-32 h-4" />
            <div className="skeleton skeleton-text w-full h-3" />
          </div>
          
          {/* Time */}
          <div className="skeleton skeleton-text w-12 h-3" />
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <div className="skeleton skeleton-avatar w-10 h-10" />
        <div className="flex-1 space-y-2">
          <div className="skeleton skeleton-text w-32 h-4" />
          <div className="skeleton skeleton-text w-20 h-3" />
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`skeleton rounded-2xl ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} style={{ height: '60px' }} />
          </div>
        ))}
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="skeleton rounded-xl h-12 w-full" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-border/50 space-y-2">
          <div className="flex items-start gap-3">
            <div className="skeleton skeleton-avatar w-8 h-8" />
            <div className="flex-1 space-y-2">
              <div className="skeleton skeleton-text w-48 h-4" />
              <div className="skeleton skeleton-text w-full h-3" />
              <div className="skeleton skeleton-text w-24 h-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudentListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton skeleton-avatar w-12 h-12" />
            <div className="flex-1 space-y-2">
              <div className="skeleton skeleton-text w-32 h-4" />
              <div className="skeleton skeleton-text w-24 h-3" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="skeleton skeleton-text w-full h-3" />
            <div className="skeleton skeleton-text w-3/4 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeacherListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton skeleton-avatar w-16 h-16" />
            <div className="flex-1 space-y-2">
              <div className="skeleton skeleton-text w-32 h-4" />
              <div className="skeleton skeleton-text w-24 h-3" />
            </div>
          </div>
          <div className="skeleton skeleton-text w-full h-10 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="skeleton skeleton-avatar w-24 h-24" />
        <div className="flex-1 space-y-2">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text w-48 h-3" />
        </div>
      </div>
      
      {/* Info Cards */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton-card space-y-3">
          <div className="skeleton skeleton-text w-32 h-5" />
          <div className="space-y-2">
            <div className="skeleton skeleton-text w-full h-3" />
            <div className="skeleton skeleton-text w-5/6 h-3" />
            <div className="skeleton skeleton-text w-4/6 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HorizontalTeacherScrollSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-24">
          <div className="skeleton skeleton-avatar w-20 h-20 mx-auto mb-2" />
          <div className="skeleton skeleton-text w-full h-3" />
        </div>
      ))}
    </div>
  );
}
