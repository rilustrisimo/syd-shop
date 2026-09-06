import { supabase } from '@/lib/supabase/client'
import { getProducts } from '@/lib/supabase/queries/products'
import type { ShopSettings, PublicShopSettings, ShopCategory, ShopQrCode, ShopBankAccount } from '@/lib/types'

// Full settings including coordinates — server-side only
export async function getShopSettings(): Promise<ShopSettings | null> {
  const { data, error } = await supabase
    .from('shop_settings')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('Failed to fetch shop settings:', error.message)
    return null
  }
  return data as ShopSettings
}

// Public settings — safe to expose to the browser (no store lat/lng)
export async function getPublicShopSettings(): Promise<PublicShopSettings | null> {
  const { data, error } = await supabase
    .from('shop_settings')
    .select(`
      id, store_name, store_phone, store_address,
      gcash_number, gcash_name,
      bank_name, bank_account_no, bank_account_name,
      qr_code_url, store_hours, staff_notification_emails,
      delivery_fee_flat, delivery_fee_per_km, cod_radius_km,
      branch_id
    `)
    .limit(1)
    .single()

  if (error) {
    console.error('Failed to fetch public shop settings:', error.message)
    return null
  }
  return data as PublicShopSettings
}

// Active payment QR codes for checkout (e.g. GCash, BDO, BPI, GoTyme) —
// managed by staff in the POS admin settings.
export async function getShopQrCodes(): Promise<ShopQrCode[]> {
  const { data, error } = await supabase
    .from('shop_qr_codes')
    .select('id, label, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch shop QR codes:', error.message)
    return []
  }
  return data as ShopQrCode[]
}

// Active bank transfer accounts for checkout — managed by staff in the
// POS admin settings.
export async function getShopBankAccounts(): Promise<ShopBankAccount[]> {
  const { data, error } = await supabase
    .from('shop_bank_accounts')
    .select('id, bank_name, account_name, account_number, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch shop bank accounts:', error.message)
    return []
  }
  return data as ShopBankAccount[]
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name, subcategories:product_subcategories(id, name)')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

// Categories that currently have at least one product visible in the shop —
// an empty category is a dead end for the customer, so it's left out of nav.
// Cached briefly: both the catalog layout and each category page need this
// (the layout for the sidebar, the page to resolve/validate its slug), and
// without caching that's two full unfiltered-product fetches per request.
let visibleCategoriesCache: { branchId: string; data: ShopCategory[]; expiresAt: number } | null = null
let visibleCategoriesPromise: Promise<ShopCategory[]> | null = null
const VISIBLE_CATEGORIES_CACHE_MS = 60_000

export async function getVisibleCategories(branchId: string): Promise<ShopCategory[]> {
  if (visibleCategoriesCache && visibleCategoriesCache.branchId === branchId && visibleCategoriesCache.expiresAt > Date.now()) {
    return visibleCategoriesCache.data
  }
  if (visibleCategoriesPromise) return visibleCategoriesPromise

  visibleCategoriesPromise = (async () => {
    const [categories, { products }] = await Promise.all([
      getCategories(),
      getProducts({ branchId }),
    ])
    const visibleCategoryIds = new Set(products.map(p => p.category_id))
    const data = categories.filter(c => visibleCategoryIds.has(c.id))
    visibleCategoriesCache = { branchId, data, expiresAt: Date.now() + VISIBLE_CATEGORIES_CACHE_MS }
    visibleCategoriesPromise = null
    return data
  })()

  return visibleCategoriesPromise
}
