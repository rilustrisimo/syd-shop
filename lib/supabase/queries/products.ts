import { supabase } from '@/lib/supabase/client'
import type { ShopProduct, ShopProductDetail } from '@/lib/types'

interface FetchProductsParams {
  branchId: string
  categoryId?: string
  search?: string
  inStockOnly?: boolean
  page?: number
  limit?: number
}

export async function getProducts({
  branchId,
  categoryId,
  search,
  inStockOnly = false,
  page = 1,
  limit = 48,
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
    `, { count: 'exact' })
    .eq('is_active', true)
    .order('name')

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
  }

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  const products: ShopProduct[] = (data ?? [])
    .filter((p: any) => !p.overrides?.[0]?.hidden_online)
    .map((p: any) => {
      const branchInventory = (p.inventory ?? []).find(
        (inv: any) => inv.branch_id === branchId
      )
      const quantity_on_hand = Number(branchInventory?.quantity_on_hand ?? 0)
      const primaryImage = (p.images ?? []).find((img: any) => img.is_primary)
        ?? (p.images ?? [])[0]

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
      }
    })
    .filter((p) => !inStockOnly || p.in_stock)

  return { products, total: count ?? 0 }
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
    images: images.map((img: any) => ({
      url: img.url,
      alt_text: img.alt_text,
      is_primary: img.is_primary,
      sort_order: img.sort_order ?? 0,
    })),
  }
}
