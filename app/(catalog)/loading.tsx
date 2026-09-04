// Scoped inside the (catalog) layout's Suspense boundary — only this grid
// area swaps to a skeleton while a category loads. The header/sidebar in
// CatalogShell live in the layout, above this boundary, so they stay put.
export default function Loading() {
  return (
    <>
      <div className="h-4 w-40 bg-slate-200 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-100 animate-pulse h-64" />
        ))}
      </div>
    </>
  )
}
