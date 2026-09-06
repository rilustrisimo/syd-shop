import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getShopSettings, getShopQrCodes, getShopBankAccounts } from '@/lib/supabase/queries/shop-settings'
import { CheckoutClient } from '@/components/checkout-client'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const [settings, qrCodes, bankAccounts] = await Promise.all([
    getShopSettings(),
    getShopQrCodes(),
    getShopBankAccounts(),
  ])
  if (!settings) redirect('/')

  return <CheckoutClient settings={settings} qrCodes={qrCodes} bankAccounts={bankAccounts} />
}
