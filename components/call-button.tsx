import { Phone } from 'lucide-react'

interface CallButtonProps {
  phone: string
}

// Always-visible fallback for anyone who'd rather just call than finish
// checkout online — a safety net if the site trips someone up. Bottom-left
// so it never collides with the cart FAB (bottom-right, desktop only).
// Several pages (cart, checkout, product detail) also show a full-width
// sticky action bar at the very bottom on mobile — bottom-24 there clears
// the tallest of those with room to spare; bottom-6 once that bar is gone
// at sm+ widths.
export function CallButton({ phone }: CallButtonProps) {
  return (
    <a
      href={`tel:${phone}`}
      className="fixed bottom-24 sm:bottom-6 left-6 z-40 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white pl-4 pr-5 py-3.5 rounded-full shadow-xl font-bold transition-all hover:scale-105"
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
