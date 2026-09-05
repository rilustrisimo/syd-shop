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
// Product detail, cart, and checkout pages always show a full-width sticky
// action bar at the very bottom on mobile; the home/category pages only
// show one once the cart has items. Sit low (bottom-6) everywhere else so
// it doesn't float awkwardly high with nothing to clear underneath it.
export function CallButton({ phone }: CallButtonProps) {
  const pathname = usePathname()
  const { itemCount } = useCart()

  const alwaysHasBottomBar =
    pathname?.startsWith('/products/') || pathname === '/cart' || pathname === '/checkout'
  const hasBottomBar = alwaysHasBottomBar || itemCount > 0

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
