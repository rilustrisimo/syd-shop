import type { Metadata } from 'next'
import { getShopSettings, getCategories } from '@/lib/supabase/queries/shop-settings'
import { CatalogClient } from '@/components/catalog-client'

export const metadata: Metadata = { title: 'Browse Products' }
export const revalidate = 60

export default async function CatalogPage() {
  const [settings, categories] = await Promise.all([
    getShopSettings(),
    getCategories(),
  ])

  return (
    <CatalogClient
      categories={categories}
      branchId={settings?.branch_id ?? ''}
      storeName={settings?.store_name ?? 'SYD Construction Supplies'}
    />
  )
}
