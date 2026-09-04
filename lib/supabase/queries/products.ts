import { supabase } from '@/lib/supabase/client'
import type { ShopProduct, ShopProductDetail } from '@/lib/types'

interface FetchProductsParams {
  branchId: string
  categoryId?: string
  search?: string
  inStockOnly?: boolean
}

const STALE_CUTOFF_MS = 90 * 24 * 60 * 60 * 1000

// A product is hidden from the shop only when it's a proven slow mover
// (sold before, but not in the last 90 days) AND currently has zero stock.
// Never-sold products and anything still on the shelf stay visible.
function isDeadStock(lastSaleAt: string | null, quantityOnHand: number): boolean {
  if (!lastSaleAt || quantityOnHand > 0) return false
  return Date.now() - new Date(lastSaleAt).getTime() > STALE_CUTOFF_MS
}

type SalesStatsMap = Map<string, { last_sale_at: string | null; qty_sold_90d: number }>

// The stats view rarely changes minute-to-minute, and re-fetching it on every
// navigation/category switch was adding a redundant round trip each time.
// Cache it for a short window (module-scoped — separate per server process
// and per browser tab, which is the right granularity here).
let statsCache: { data: SalesStatsMap; expiresAt: number } | null = null
let statsPromise: Promise<SalesStatsMap> | null = null
const STATS_CACHE_MS = 60_000

async function getSalesStatsMap(): Promise<SalesStatsMap> {
  if (statsCache && statsCache.expiresAt > Date.now()) return statsCache.data
  if (statsPromise) return statsPromise

  statsPromise = (async () => {
    const { data: stats, error: statsError } = await supabase
      .from('product_sales_stats')
      .select('product_id, last_sale_at, qty_sold_90d')
    if (statsError) {
      console.error('Failed to fetch product sales stats:', statsError.message)
    }
    const map: SalesStatsMap = new Map()
    for (const row of stats ?? []) {
      map.set(row.product_id, {
        last_sale_at: row.last_sale_at,
        qty_sold_90d: Number(row.qty_sold_90d ?? 0),
      })
    }
    statsCache = { data: map, expiresAt: Date.now() + STATS_CACHE_MS }
    statsPromise = null
    return map
  })()

  return statsPromise
}

export async function getProducts({
  branchId,
  categoryId,
  search,
  inStockOnly = false,
}: FetchProductsParams): Promise<{ products: ShopProduct[]; total: number }> {
  let query = supabase
    .from('products')
    .select(`
      id, code, name, description, current_selling_price,
      category_id,
      category:product_categories!products_category_id_fkey(id, name),
      subcategory_id,
      subcategory:product_subcategories(id, name),
      selling_uom:units_of_measure!products_selling_uom_id_fkey(code, name),
      images:product_images(url, alt_text, is_primary, sort_order),
      inventory:branch_inventory(quantity_on_hand, branch_id),
      overrides:shop_product_overrides(hidden_online)
    `)
    .eq('is_active', true)
    .order('name')

  // A search term searches across all products, ignoring the current
  // category page — clearing the search reverts to the category-scoped list.
  if (categoryId && !search) {
    query = query.eq('category_id', categoryId)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  const statsMap = await getSalesStatsMap()

  const products: ShopProduct[] = (data ?? [])
    .filter((p: any) => !p.overrides?.[0]?.hidden_online)
    .map((p: any) => {
      const branchInventory = (p.inventory ?? []).find(
        (inv: any) => inv.branch_id === branchId
      )
      const quantity_on_hand = Number(branchInventory?.quantity_on_hand ?? 0)
      const primaryImage = (p.images ?? []).find((img: any) => img.is_primary)
        ?? (p.images ?? [])[0]
      const stats = statsMap.get(p.id)

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        current_selling_price: Number(p.current_selling_price),
        primary_image_url: primaryImage?.url ?? null,
        unit_label: p.selling_uom?.code ?? p.selling_uom?.name ?? 'pc',
        category_id: p.category_id,
        category_name: p.category?.name ?? '',
        subcategory_id: p.subcategory_id,
        subcategory_name: p.subcategory?.name ?? null,
        quantity_on_hand,
        in_stock: quantity_on_hand > 0,
        qty_sold_90d: stats?.qty_sold_90d ?? 0,
        last_sale_at: stats?.last_sale_at ?? null,
      }
    })
    .filter((p) => !isDeadStock(p.last_sale_at, p.quantity_on_hand))
    .filter((p) => !inStockOnly || p.in_stock)
    .sort((a, b) =>
      Number(b.in_stock) - Number(a.in_stock) ||
      b.qty_sold_90d - a.qty_sold_90d ||
      a.name.localeCompare(b.name)
    )

  return { products, total: products.length }
}

export async function getProductById(
  id: string,
  branchId: string
): Promise<ShopProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, code, name, description, current_selling_price,
      category_id,
      category:product_categories!products_category_id_fkey(id, name),
      subcategory_id,
      subcategory:product_subcategories(id, name),
      selling_uom:units_of_measure!products_selling_uom_id_fkey(code, name),
      images:product_images(url, alt_text, is_primary, sort_order),
      inventory:branch_inventory(quantity_on_hand, branch_id),
      overrides:shop_product_overrides(hidden_online)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) return null
  if (data.overrides?.[0]?.hidden_online) return null

  const branchInventory = (data.inventory ?? []).find(
    (inv: any) => inv.branch_id === branchId
  )
  const quantity_on_hand = Number(branchInventory?.quantity_on_hand ?? 0)
  const images = [...(data.images ?? [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
  const primaryImage = images.find((img: any) => img.is_primary) ?? images[0]

  const { data: stats } = await supabase
    .from('product_sales_stats')
    .select('last_sale_at, qty_sold_90d')
    .eq('product_id', id)
    .maybeSingle()

  if (isDeadStock(stats?.last_sale_at ?? null, quantity_on_hand)) return null

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    current_selling_price: Number(data.current_selling_price),
    primary_image_url: primaryImage?.url ?? null,
    unit_label: (data as any).selling_uom?.code ?? (data as any).selling_uom?.name ?? 'pc',
    category_id: data.category_id,
    category_name: (data as any).category?.name ?? '',
    subcategory_id: data.subcategory_id,
    subcategory_name: (data as any).subcategory?.name ?? null,
    quantity_on_hand,
    in_stock: quantity_on_hand > 0,
    qty_sold_90d: Number(stats?.qty_sold_90d ?? 0),
    last_sale_at: stats?.last_sale_at ?? null,
    images: images.map((img: any) => ({
      url: img.url,
      alt_text: img.alt_text,
      is_primary: img.is_primary,
      sort_order: img.sort_order ?? 0,
    })),
  }
}

export async function getStockMap(
  productIds: string[],
  branchId: string
): Promise<Record<string, number>> {
  if (productIds.length === 0 || !branchId) return {}

  const { data, error } = await supabase
    .from('branch_inventory')
    .select('product_id, quantity_on_hand')
    .eq('branch_id', branchId)
    .in('product_id', productIds)

  if (error) throw error

  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    map[row.product_id] = Number(row.quantity_on_hand ?? 0)
  }
  return map
}
