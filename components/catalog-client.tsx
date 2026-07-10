'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Search, Plus, Minus, Package, Menu, X, ChevronRight } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { getProducts } from '@/lib/supabase/queries/products'
import type { ShopProduct, ShopCategory } from '@/lib/types'
import { formatPrice } from '@/components/currency'

interface CatalogClientProps {
  categories: ShopCategory[]
  branchId: string
  storeName?: string
}

export function CatalogClient({ categories, branchId, storeName = 'SYD Construction Supplies' }: CatalogClientProps) {
  const { items, itemCount, subtotal, addItem, updateQuantity } = useCart()
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const { products } = await getProducts({
        branchId,
        categoryId,
        search: debouncedSearch || undefined,
      })
      setProducts(products)
    } finally {
      setLoading(false)
    }
  }, [branchId, categoryId, debouncedSearch])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  function getCartQty(productId: string) {
    return items.find(i => i.product_id === productId)?.quantity ?? 0
  }

  function handleAdd(product: ShopProduct) {
    addItem({
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      unit_label: product.unit_label,
      unit_price: product.current_selling_price,
      quantity: 1,
      image_url: product.primary_image_url,
    })
  }

  function selectCategory(id: string | undefined) {
    setCategoryId(id)
    setMobileSidebarOpen(false)
  }

  const selectedCategory = categories.find(c => c.id === categoryId)

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex items-center gap-3 h-16">
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden flex-shrink-0 p-1 text-slate-400 hover:text-white transition-colors"
              onClick={() => setMobileSidebarOpen(v => !v)}
              aria-label="Categories"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="relative w-12 h-8">
                <Image src="/syd-logo.svg" alt="SYD Logo" fill className="object-contain" priority />
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-[11px] font-bold text-[#ffc107] tracking-wide uppercase leading-none">SYD Construction</p>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">Supplies Trading</p>
              </div>
            </Link>

            {/* Search bar */}
            <div className="flex-1 max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search products..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#ffc107] focus:bg-slate-750 transition-colors"
                />
              </div>
            </div>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative flex-shrink-0 flex items-center gap-2 bg-[#ffc107] hover:bg-amber-400 text-slate-900 text-sm font-bold px-3 py-2 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="flex items-center justify-center bg-slate-900 text-[#ffc107] text-xs font-bold rounded-full w-5 h-5 leading-none">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 lg:px-6 gap-6 py-6">
        {/* ── Desktop Category Sidebar ── */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-24 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-900">
              <p className="text-[10px] font-bold text-[#ffc107] uppercase tracking-widest">Categories</p>
            </div>
            <nav className="p-2">
              <button
                onClick={() => selectCategory(undefined)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  !categoryId
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                All Products
                {!categoryId && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    categoryId === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {cat.name}
                  {categoryId === cat.id && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Mobile Category Sidebar (overlay) ── */}
        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-30 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative w-64 bg-white h-full overflow-y-auto shadow-xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
                <p className="text-[10px] font-bold text-[#ffc107] uppercase tracking-widest">Categories</p>
              </div>
              <nav className="p-2">
                <button
                  onClick={() => selectCategory(undefined)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    !categoryId ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Products
                  {!categoryId && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                      categoryId === cat.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name}
                    {categoryId === cat.id && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* ── Product Grid ── */}
        <main className="flex-1 min-w-0 pb-28 lg:pb-0">
          {/* Breadcrumb / active filter */}
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm text-slate-500">
              {selectedCategory ? (
                <>
                  <button onClick={() => selectCategory(undefined)} className="hover:text-blue-600 transition-colors">All Products</button>
                  {' › '}
                  <span className="font-medium text-slate-900">{selectedCategory.name}</span>
                </>
              ) : (
                <span className="font-medium text-slate-900">All Products</span>
              )}
            </p>
            {!loading && (
              <span className="text-xs text-slate-400">({products.length} items)</span>
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
              {products.map(product => {
                const qty = getCartQty(product.id)
                return (
                  <div
                    key={product.id}
                    className="group bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
                  >
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

                        {product.in_stock ? (
                          qty === 0 ? (
                            <button
                              onClick={() => handleAdd(product)}
                              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add to Cart
                            </button>
                          ) : (
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5">
                              <button
                                onClick={() => updateQuantity(product.id, qty - 1)}
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-blue-300 text-blue-600 hover:bg-blue-100"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold text-blue-700">{qty}</span>
                              <button
                                onClick={() => updateQuantity(product.id, qty + 1)}
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        ) : (
                          <p className="text-center text-xs text-slate-400 py-1.5">Unavailable</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── Sticky Cart Bar (mobile only) ── */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden p-3 bg-slate-900 border-t border-slate-800 shadow-lg">
          <Link
            href="/cart"
            className="flex items-center justify-between bg-[#ffc107] hover:bg-amber-400 text-slate-900 px-4 py-3 rounded-xl font-bold shadow-md transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center bg-slate-900/20 text-slate-900 text-xs font-bold rounded-full w-5 h-5">
                {itemCount}
              </span>
              <span className="text-sm">View Cart</span>
            </div>
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </Link>
        </div>
      )}

      {/* ── Desktop Cart FAB ── */}
      {itemCount > 0 && (
        <Link
          href="/cart"
          className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-3 bg-[#ffc107] hover:bg-amber-400 text-slate-900 px-5 py-3 rounded-full shadow-xl font-bold transition-all hover:scale-105"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
          <span className="bg-slate-900/15 rounded-full px-2 py-0.5 text-sm">{formatPrice(subtotal)}</span>
        </Link>
      )}
    </div>
  )
}
