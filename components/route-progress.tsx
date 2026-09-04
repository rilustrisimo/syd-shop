'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// A slim top progress bar that gives instant feedback the moment someone
// clicks an internal link, and completes when the new route has rendered.
// Next.js App Router has no public "navigation start/end" event, so this
// listens for clicks on same-origin <a> tags to start the bar, and watches
// usePathname() to know when the destination has actually mounted.
export function RouteProgress() {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const finishTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const anchor = (e.target as HTMLElement)?.closest('a')
      if (!anchor) return
      if (anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      if (finishTimeout.current) clearTimeout(finishTimeout.current)
      setVisible(true)
      setWidth(15)
      requestAnimationFrame(() => setWidth(75))
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    if (pathname === prevPathname.current) return
    prevPathname.current = pathname

    setWidth(100)
    if (finishTimeout.current) clearTimeout(finishTimeout.current)
    finishTimeout.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 300)

    return () => {
      if (finishTimeout.current) clearTimeout(finishTimeout.current)
    }
  }, [pathname])

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 z-[100] h-[3px] pointer-events-none transition-[width,opacity] ease-out"
      style={{
        width: `${width}%`,
        opacity: visible ? 1 : 0,
        transitionDuration: visible ? '600ms, 200ms' : '200ms, 300ms',
        background: 'linear-gradient(to right, #ffc107, #ff9800)',
        boxShadow: '0 0 8px rgba(255, 193, 7, 0.6)',
      }}
    />
  )
}
