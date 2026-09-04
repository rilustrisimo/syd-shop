import type { Metadata } from 'next'
import { getPublicShopSettings } from '@/lib/supabase/queries/shop-settings'
import { CartClient } from '@/components/cart-client'

export const metadata: Metadata = { title: 'Cart' }

export default async function CartPage() {
  const settings = await getPublicShopSettings()

  return <CartClient branchId={settings?.branch_id ?? ''} />
}
