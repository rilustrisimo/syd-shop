export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 pb-32 lg:pb-6">
      <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md h-16" />
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
        <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          <div className="aspect-square bg-white rounded-2xl border border-slate-200 animate-pulse" />
          <div className="mt-6 lg:mt-0 space-y-4">
            <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
            <div className="h-7 bg-slate-200 rounded animate-pulse w-3/4" />
            <div className="h-9 bg-slate-200 rounded animate-pulse w-1/2" />
            <div className="h-6 bg-slate-200 rounded-full animate-pulse w-28" />
            <div className="h-20 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-14 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
