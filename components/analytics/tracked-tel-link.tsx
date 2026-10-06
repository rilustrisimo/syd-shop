'use client'

import { pushDataLayerEvent } from '@/lib/analytics'

interface TrackedTelLinkProps {
  phone: string
  className?: string
  children: React.ReactNode
}

// A small client leaf for a tel: link's onClick tracking, so pages that
// are otherwise server components (like the order confirmation page)
// don't need to become client components just for this one interaction.
export function TrackedTelLink({ phone, className, children }: TrackedTelLinkProps) {
  return (
    <a
      href={`tel:${phone}`}
      className={className}
      onClick={() => pushDataLayerEvent('contact', { method: 'phone' })}
    >
      {children}
    </a>
  )
}
