import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getShopSettings } from '@/lib/supabase/queries/shop-settings'
import { CheckoutClient } from '@/components/checkout-client'

export const metadata: Metadata = { title: 'Review Your List' }

export default async function ReviewPage() {
  const settings = await getShopSettings()
  if (!settings) redirect('/')

  return <CheckoutClient settings={settings} />
}
