import { Skeleton } from "@/components/ui/skeleton"

export function TeacherDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header Skeleton */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl bg-white/10" />
              <div>
                <Skeleton className="h-6 w-48 mb-2 bg-white/10" />
                <Skeleton className="h-4 w-32 bg-white/10" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
              <Skeleton className="w-40 h-10 rounded-xl bg-white/10" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="w-12 h-12 rounded-xl bg-white/10" />
                <Skeleton className="h-8 w-12 bg-white/10" />
              </div>
              <Skeleton className="h-4 w-24 bg-white/10" />
            </div>
          ))}
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-xl bg-white/10 flex-shrink-0" />
          ))}
        </div>

        {/* Content Grid Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <Skeleton className="h-6 w-3/4 mb-4 bg-white/10" />
              <Skeleton className="h-4 w-full mb-2 bg-white/10" />
              <Skeleton className="h-4 w-2/3 mb-4 bg-white/10" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 bg-white/10" />
                <Skeleton className="h-8 w-8 rounded-lg bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
