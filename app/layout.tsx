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
