'use client'

import { memo, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Minus, Package, Loader2 } from 'lucide-react'
import { fetchStorefrontProducts } from '@/app/(catalog)/actions'
import { useCatalogContext } from '@/lib/catalog-context'
import type { ShopProduct } from '@/lib/types'
import { formatPrice } from '@/components/currency'
import { QtyInput } from '@/components/qty-input'

const PAGE_SIZE = 24

interface ProductGridProps {
  categoryId?: string
}

interface ProductCardProps {
  product: ShopProduct
  qty: number
  onAdd: (product: ShopProduct) => void
  onUpdateQuantity: (productId: string, quantity: number) => void
}

// Memoized so a parent re-render (e.g. the breadcrumb updating on every
// search keystroke) doesn't force all ~24 visible cards to re-render too —
// each card only re-renders when its own product/qty actually changes.
const ProductCard = memo(function ProductCard({ product, qty, onAdd, onUpdateQuantity }: ProductCardProps) {
  return (
    <div className="group bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-square bg-slate-100 overflow-hidden">
          {product.primary_image_url ? (
            <Image
              src={product.primary_image_url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="w-12 h-12 text-slate-200" />
            </div>
          )}
          {!product.in_stock && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
              <span className="text-white text-xs font-semibold bg-slate-900/70 px-3 py-1 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 flex flex-col flex-1 gap-2">
        <Link href={`/products/${product.id}`}>
          <p className="text-xs text-slate-500 leading-snug line-clamp-2 min-h-[2rem]">{product.name}</p>
        </Link>

        <div className="mt-auto space-y-2">
          <div>
            <p className="text-base font-bold text-[#ffc107]">{formatPrice(product.current_selling_price)}</p>
            <p className="text-[11px] text-slate-400">per {product.unit_label}</p>
          </div>

          {qty === 0 ? (
            <button
              onClick={() => onAdd(product)}
              className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors ${
                product.in_stock
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {product.in_stock ? 'Add to Cart' : 'Request'}
            </button>
          ) : (
            <div>
              {!product.in_stock && (
                <p className="text-[10px] font-semibold text-amber-600 mb-1 text-center">On Request</p>
              )}
              <div className={`flex items-center justify-between rounded-lg px-2 py-1.5 border ${
                product.in_stock ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <button
                  onClick={() => onUpdateQuantity(product.id, qty - 1)}
                  className={`w-6 h-6 flex items-center justify-center rounded-full bg-white border ${
                    product.in_stock
                      ? 'border-blue-300 text-blue-600 hover:bg-blue-100'
                      : 'border-amber-300 text-amber-600 hover:bg-amber-100'
                  }`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <QtyInput
                  value={qty}
                  onChange={(v) => onUpdateQuantity(product.id, v)}
                  className={`w-10 bg-transparent text-center text-sm font-bold focus:outline-none ${product.in_stock ? 'text-blue-700' : 'text-amber-700'}`}
                />
                <button
                  onClick={() => onUpdateQuantity(product.id, qty + 1)}
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-white ${
                    product.in_stock ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export function ProductGrid({ categoryId }: ProductGridProps) {
  const { branchId, categories, search, setSearch, cart } = useCatalogContext()
  const { items, addItem, updateQuantity } = cart
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Lets React deprioritize the breadcrumb/list re-render this value drives
  // while the search <input> itself (a separate component) stays instantly
  // responsive to every keystroke — the standard fix for input lag on
  // search-as-you-type UIs backed by a non-trivial result list.
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Reset to page one whenever the branch, category, or search changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchStorefrontProducts({
      branchId,
      categoryId,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: 0,
    }).then(({ products: page, total: pageTotal }) => {
      if (cancelled) return
      setProducts(page)
      setTotal(pageTotal)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [branchId, categoryId, debouncedSearch])

  const hasMore = products.length < total

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const { products: nextPage } = await fetchStorefrontProducts({
        branchId,
        categoryId,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: products.length,
      })
      setProducts(prev => [...prev, ...nextPage])
    } finally {
      setLoadingMore(false)
    }
  }, [branchId, categoryId, debouncedSearch, products.length, hasMore, loading, loadingMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '600px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  const handleAdd = useCallback((product: ShopProduct) => {
    addItem({
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      unit_label: product.unit_label,
      unit_price: product.current_selling_price,
      quantity: 1,
      image_url: product.primary_image_url,
    })
  }, [addItem])

  const selectedCategory = categories.find(c => c.id === categoryId)
  const isSearching = deferredSearch.trim().length > 0

  return (
    <>
      {/* Breadcrumb / active filter */}
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-slate-500">
          {isSearching ? (
            <span className="font-medium text-slate-900">Search results for &quot;{deferredSearch.trim()}&quot;</span>
          ) : selectedCategory ? (
            <>
              <Link href="/" className="hover:text-blue-600 transition-colors cursor-pointer">All Products</Link>
              {' › '}
              <span className="font-medium text-slate-900">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="font-medium text-slate-900">All Products</span>
          )}
        </p>
        {!loading && (
          <span className="text-xs text-slate-400">({total} items)</span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white border border-slate-100 animate-pulse h-64" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Package className="w-14 h-14 opacity-30" />
          <p className="text-sm font-medium">No products found</p>
          {search && (
            <button onClick={() => setSearch('')} className="text-blue-600 text-sm underline">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              qty={items.find(i => i.product_id === product.id)?.quantity ?? 0}
              onAdd={handleAdd}
              onUpdateQuantity={updateQuantity}
            />
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
        </div>
      )}
    </>
  )
}
