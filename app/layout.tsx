import type { Metadata } from 'next'
import { RouteProgress } from '@/components/route-progress'
import { CallButton } from '@/components/call-button'
import { getPublicShopSettings } from '@/lib/supabase/queries/shop-settings'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s · SYD Construction Supplies',
    default: 'SYD Construction Supplies — Shop Online',
  },
  description: 'Order quality construction materials online for delivery or pickup in Bukidnon.',
  icons: { icon: '/icon.svg' },
  // Safari/iOS can auto-detect and auto-link plain-text phone numbers
  // anywhere on the page; on some versions that heuristic misfires and
  // triggers the "blocked from automatically starting a call" warning
  // even for genuine taps on our own explicit tel: links. Disabling it
  // sitewide leaves our deliberate tel: links (CallButton, order
  // confirmation) completely unaffected since those are real anchors,
  // not auto-detected text.
  formatDetection: { telephone: false },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicShopSettings()

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        <RouteProgress />
        {children}
        {settings?.store_phone && <CallButton phone={settings.store_phone} />}
      </body>
    </html>
  )
}
