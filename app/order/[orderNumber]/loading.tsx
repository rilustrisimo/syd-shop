export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 border-b border-slate-800 shadow-md h-16" />
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-16 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-40 animate-pulse" />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-56 animate-pulse" />
      </div>
    </div>
  )
}
