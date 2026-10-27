'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { pushDataLayerEvent } from '@/lib/analytics'

// The Meta Pixel (loaded by GTM) also fires its own PageView whenever the
// URL changes via history.pushState/replaceState — on top of the PageView
// GTM sends for our page_view, so client-side navigations counted 2-3
// times. disablePushState is Meta's switch for single-page apps; fbq loads
// asynchronously through GTM, so wait for it.
function useDisableMetaAutoPageView() {
  useEffect(() => {
    const disable = () => {
      const fbq = (window as unknown as { fbq?: { disablePushState?: boolean } }).fbq
      if (!fbq) return false
      fbq.disablePushState = true
      return true
    }
    if (disable()) return
    const timer = setInterval(() => { if (disable()) clearInterval(timer) }, 100)
    const stop = setTimeout(() => clearInterval(timer), 15000)
    return () => { clearInterval(timer); clearTimeout(stop) }
  }, [])
}

// GTM's own automatic pageview trigger only fires once, on the initial
// hard page load — Next.js App Router navigations after that never
// trigger a real browser navigation, so GTM never sees them without this.
// Mirrors components/route-progress.tsx's usePathname()-diff pattern.
function PageViewTrackerInner() {
  useDisableMetaAutoPageView()
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
