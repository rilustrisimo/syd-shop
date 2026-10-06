'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { pushDataLayerEvent } from '@/lib/analytics'

// GTM's own automatic pageview trigger only fires once, on the initial
// hard page load — Next.js App Router navigations after that never
// trigger a real browser navigation, so GTM never sees them without this.
// Mirrors components/route-progress.tsx's usePathname()-diff pattern.
function PageViewTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    const fullPath = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname
    if (fullPath === prevPath.current) return
    prevPath.current = fullPath
    pushDataLayerEvent('page_view', { page_path: fullPath })
  }, [pathname, searchParams])

  return null
}

// useSearchParams() requires a Suspense boundary wherever it's used —
// this wraps it so the root layout can mount PageViewTracker directly.
export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  )
}
