'use client'

import { usePathname } from 'next/navigation'
import { Phone } from 'lucide-react'
import { useCart } from '@/lib/cart'

interface CallButtonProps {
  phone: string
}

// Always-visible fallback for anyone who'd rather just call than finish
// checkout online — a safety net if the site trips someone up. Bottom-left
// so it never collides with the cart FAB (bottom-right, desktop only).
//
// Hidden on product detail/cart/checkout: those pages already have their
// own prominent sticky action bar and a specific task the visitor is mid-
// way through, so a second floating CTA is redundant there — and worse,
// a fixed-position button combined with a fixed bottom bar leaves a thin
// vertical corridor where normal (non-fixed) page content keeps ending up
// sandwiched between them on shorter viewports (seen colliding with both
// the category menu and, on this page, the price/thumbnails depending on
// content length — tuning the offset per-page doesn't hold up, since any
// fixed position can coincide with *something* as content varies).
export function CallButton({ phone }: CallButtonProps) {
  const pathname = usePathname()
  const { itemCount } = useCart()

  const hasOwnActionBar =
    pathname?.startsWith('/products/') || pathname === '/cart' || pathname === '/checkout'
  if (hasOwnActionBar) return null

  // Home/category pages show a floating "View Cart" bar once the cart has
  // items — sit low otherwise so it doesn't float awkwardly high with
  // nothing to clear underneath it.
  const hasBottomBar = itemCount > 0

  return (
    <a
      href={`tel:${phone}`}
      className={`fixed ${hasBottomBar ? 'bottom-24' : 'bottom-6'} sm:bottom-6 left-6 z-40 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white pl-4 pr-5 py-3.5 rounded-full shadow-xl font-bold transition-all hover:scale-105`}
    >
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
      </span>
      <Phone className="w-5 h-5" />
      <span className="hidden sm:inline">Call to Order</span>
    </a>
  )
}
