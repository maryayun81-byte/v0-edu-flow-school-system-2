'use client';

import { Lock, Unlock, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

interface TimetablePublisherProps {
  classId: string;
  metadata: any;
  sessions: any[];
  onPublish: (classId: string) => Promise<any>;
  onLock: (classId: string) => Promise<any>;
  onUnlock: (classId: string) => Promise<any>;
  onUnpublish: (classId: string) => Promise<any>;
}

export default function TimetablePublisher({
  classId,
  metadata,
  sessions,
  onPublish,
  onLock,
  onUnlock,
  onUnpublish,
}: TimetablePublisherProps) {
  const status = metadata?.status || 'draft';
  const draftCount = sessions.filter(s => s.status === 'draft').length;
  const publishedCount = sessions.filter(s => s.status === 'published').length;
  const lockedCount = sessions.filter(s => s.status === 'locked').length;

  const handlePublish = async () => {
    if (draftCount === 0) {
      alert('No draft sessions to publish');
      return;
    }

    if (confirm(`Publish ${draftCount} draft session(s)? They will become visible to teachers and students.`)) {
      const result = await onPublish(classId);
      if (result.success) {
        alert('Timetable published successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  const handleLock = async () => {
    if (confirm('Lock this timetable? No further edits will be allowed until unlocked.')) {
      const result = await onLock(classId);
      if (result.success) {
        alert('Timetable locked successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  const handleUnlock = async () => {
    if (confirm('Unlock this timetable? It will return to published status and can be edited.')) {
      const result = await onUnlock(classId);
      if (result.success) {
        alert('Timetable unlocked successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  const handleUnpublish = async () => {
    if (confirm('Unpublish this timetable? It will return to draft status and become invisible to teachers and students.')) {
      const result = await onUnpublish(classId);
      if (result.success) {
        alert('Timetable unpublished successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">Timetable Controls</h3>

      {/* Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{draftCount}</div>
          <div className="text-sm text-gray-300 mt-1">Draft Sessions</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{publishedCount}</div>
          <div className="text-sm text-gray-300 mt-1">Published Sessions</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{lockedCount}</div>
          <div className="text-sm text-gray-300 mt-1">Locked Sessions</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Publish */}
        <button
          onClick={handlePublish}
          disabled={status === 'locked' || draftCount === 0}
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold transition-all"
        >
          <Eye className="w-5 h-5" />
          Publish
        </button>

        {/* Unpublish */}
        <button
          onClick={handleUnpublish}
          disabled={status !== 'published'}
          className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold transition-all"
        >
          <EyeOff className="w-5 h-5" />
          Unpublish
        </button>

        {/* Lock */}
        <button
          onClick={handleLock}
          disabled={status !== 'published'}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold transition-all"
        >
          <Lock className="w-5 h-5" />
          Lock
        </button>

        {/* Unlock */}
        <button
          onClick={handleUnlock}
          disabled={status !== 'locked'}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold transition-all"
        >
          <Unlock className="w-5 h-5" />
          Unlock
        </button>
      </div>

      {/* Info Messages */}
      <div className="mt-6 space-y-3">
        {status === 'draft' && draftCount > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <strong>Draft Mode:</strong> This timetable is not visible to teachers or students. Click "Publish" to make it visible.
            </div>
          </div>
        )}

        {status === 'published' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-200">
              <strong>Published:</strong> This timetable is visible to teachers and students. You can still make edits or lock it to prevent changes.
            </div>
          </div>
        )}

        {status === 'locked' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-200">
              <strong>Locked:</strong> This timetable is read-only for all users. Click "Unlock" to allow edits.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
