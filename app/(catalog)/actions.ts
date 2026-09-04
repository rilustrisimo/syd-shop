'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getRankedProductsPageForShop } from '@/lib/supabase/queries/products'
import type { ShopProduct } from '@/lib/types'

interface FetchStorefrontProductsParams {
  branchId: string
  categoryId?: string
  search?: string
  inStockOnly?: boolean
  limit?: number
  offset?: number
}

// Runs server-side with the service-role client so trailing-90-day cost/
// revenue data (needed to rank by profit) never reaches the browser —
// only the same public ShopProduct fields the client already saw before.
// Paginated via limit/offset so the client never has to fetch (or render)
// the entire catalog at once.
export async function fetchStorefrontProducts(
  params: FetchStorefrontProductsParams
): Promise<{ products: ShopProduct[]; total: number }> {
  const { limit, offset, ...rest } = params
  return getRankedProductsPageForShop(createServerClient(), rest, { limit, offset })
}
