import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getShopSettings } from '@/lib/supabase/queries/shop-settings'
import { CheckoutClient } from '@/components/checkout-client'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const settings = await getShopSettings()
  if (!settings) redirect('/')

  return <CheckoutClient settings={settings} />
}
