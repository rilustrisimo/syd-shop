import { getShopSettings, getVisibleCategories } from '@/lib/supabase/queries/shop-settings'
import { CatalogShell } from '@/components/catalog-shell'

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getShopSettings()
  const branchId = settings?.branch_id ?? ''
  const categories = await getVisibleCategories(branchId)

  return (
    <CatalogShell
      categories={categories}
      branchId={branchId}
      storeName={settings?.store_name ?? 'SYD Construction Supplies'}
    >
      {children}
    </CatalogShell>
  )
}
