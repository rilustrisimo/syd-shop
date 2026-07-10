import { supabase } from '@/lib/supabase/client'
import type { ShopSettings, PublicShopSettings } from '@/lib/types'

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

export async function getCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name, subcategories:product_subcategories(id, name)')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}
