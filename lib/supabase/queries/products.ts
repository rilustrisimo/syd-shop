import { supabase } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
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

async function getSalesStatsMap(client: SupabaseClient): Promise<SalesStatsMap> {
  if (statsCache && statsCache.expiresAt > Date.now()) return statsCache.data
  if (statsPromise) return statsPromise

  statsPromise = (async () => {
    const { data: stats, error: statsError } = await client
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

// product_profit_stats is a server-only view (not granted to anon/authenticated)
// exposing per-product revenue/cost over the trailing 90 days. It must only
// ever be queried with the service-role client, and the resulting profit
// numbers are used purely to rank products — never attached to the
// ShopProduct objects returned to the browser.
type ProfitStatsMap = Map<string, { revenue_90d: number; cost_90d: number }>

let profitStatsCache: { data: ProfitStatsMap; expiresAt: number } | null = null
let profitStatsPromise: Promise<ProfitStatsMap> | null = null

async function getProfitStatsMap(client: SupabaseClient): Promise<ProfitStatsMap> {
  if (profitStatsCache && profitStatsCache.expiresAt > Date.now()) return profitStatsCache.data
  if (profitStatsPromise) return profitStatsPromise

  profitStatsPromise = (async () => {
    const { data: stats, error: statsError } = await client
      .from('product_profit_stats')
      .select('product_id, revenue_90d, cost_90d')
    if (statsError) {
      console.error('Failed to fetch product profit stats:', statsError.message)
    }
    const map: ProfitStatsMap = new Map()
    for (const row of stats ?? []) {
      map.set(row.product_id, {
        revenue_90d: Number(row.revenue_90d ?? 0),
        cost_90d: Number(row.cost_90d ?? 0),
      })
    }
    profitStatsCache = { data: map, expiresAt: Date.now() + STATS_CACHE_MS }
    profitStatsPromise = null
    return map
  })()

  return profitStatsPromise
}

async function queryProducts(
  client: SupabaseClient,
  { branchId, categoryId, search, inStockOnly = false }: FetchProductsParams,
  opts: { rankByProfit?: boolean } = {}
): Promise<{ products: ShopProduct[]; total: number }> {
  let query = client
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

  const statsMap = await getSalesStatsMap(client)
  const profitMap = opts.rankByProfit ? await getProfitStatsMap(client) : null

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

  if (profitMap) {
    // Rank by gross profit contributed over the trailing 90 days (revenue
    // minus cost) so a high-volume, low-margin product no longer
    // automatically outranks a lower-volume but more profitable one.
    // Quantity sold stays as the tiebreaker for equal/zero-profit items.
    products.sort((a, b) => {
      const profitA = profitMap.get(a.id)
      const profitB = profitMap.get(b.id)
      const pA = profitA ? profitA.revenue_90d - profitA.cost_90d : 0
      const pB = profitB ? profitB.revenue_90d - profitB.cost_90d : 0
      return (
        Number(b.in_stock) - Number(a.in_stock) ||
        pB - pA ||
        b.qty_sold_90d - a.qty_sold_90d ||
        a.name.localeCompare(b.name)
      )
    })
  } else {
    products.sort((a, b) =>
      Number(b.in_stock) - Number(a.in_stock) ||
      b.qty_sold_90d - a.qty_sold_90d ||
      a.name.localeCompare(b.name)
    )
  }

  return { products, total: products.length }
}

export async function getProducts(
  params: FetchProductsParams
): Promise<{ products: ShopProduct[]; total: number }> {
  return queryProducts(supabase, params)
}

// Server-only: ranks products by trailing-90-day gross profit instead of
// pure quantity sold. `client` must be the service-role client
// (see lib/supabase/server.ts) since product_profit_stats isn't
// anon/authenticated-readable. Call this only from server components/actions.
export async function getRankedProductsForShop(
  client: SupabaseClient,
  params: FetchProductsParams
): Promise<{ products: ShopProduct[]; total: number }> {
  return queryProducts(client, params, { rankByProfit: true })
}

interface PageOpts {
  limit?: number
  offset?: number
}

// Server-only, paginated: pushes filtering, profit-ranking, and LIMIT/OFFSET
// into a single RPC (get_shop_product_catalog, migration 00079) so pages stay
// correctly ordered and cheap at any catalog size — the old getProducts/
// getRankedProductsForShop path fetches the entire matching set in one go,
// which doesn't scale toward thousands of products. `client` must be the
// service-role client; falls back to the unpaginated ranked fetch (still
// correct, just without pagination) if the RPC/migration isn't deployed yet,
// so the storefront never shows a blank page.
export async function getRankedProductsPageForShop(
  client: SupabaseClient,
  params: FetchProductsParams,
  { limit = 24, offset = 0 }: PageOpts = {}
): Promise<{ products: ShopProduct[]; total: number }> {
  const { branchId, categoryId, search, inStockOnly = false } = params

  const { data, error } = await client.rpc('get_shop_product_catalog', {
    p_branch_id: branchId,
    p_category_id: categoryId ?? null,
    p_search: search ?? null,
    p_in_stock_only: inStockOnly,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('get_shop_product_catalog RPC failed, falling back to unpaginated fetch:', error.message)
    return getRankedProductsForShop(client, params)
  }

  const rows = (data ?? []) as any[]
  const products: ShopProduct[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    current_selling_price: Number(r.current_selling_price),
    primary_image_url: r.primary_image_url,
    unit_label: r.uom_code ?? r.uom_name ?? 'pc',
    category_id: r.category_id,
    category_name: r.category_name ?? '',
    subcategory_id: r.subcategory_id,
    subcategory_name: r.subcategory_name,
    quantity_on_hand: Number(r.quantity_on_hand),
    in_stock: r.in_stock,
    qty_sold_90d: Number(r.qty_sold_90d),
    last_sale_at: r.last_sale_at,
  }))

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0

  return { products, total }
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
