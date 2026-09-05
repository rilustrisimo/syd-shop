'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, Search, Menu, X, ChevronRight } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { slugify } from '@/lib/slug'
import { CatalogContext } from '@/lib/catalog-context'
import type { ShopCategory } from '@/lib/types'
import { formatPrice } from '@/components/currency'

interface CatalogShellProps {
  categories: ShopCategory[]
  branchId: string
  storeName?: string
  children: React.ReactNode
}

function categoryHref(categoryId: string, categories: ShopCategory[]) {
  const cat = categories.find(c => c.id === categoryId)
  return cat ? `/category/${slugify(cat.name)}` : '/'
}

// The header, category sidebars, and cart chrome — this stays mounted across
// navigations between "/" and "/category/[slug]" (both render inside this
// shell's layout), so switching categories only ever replaces the product
// grid area, not the nav bar.
export function CatalogShell({ categories, branchId, storeName = 'SYD Construction Supplies', children }: CatalogShellProps) {
  const pathname = usePathname()
  const activeCategoryId = categories.find(c => `/category/${slugify(c.name)}` === pathname)?.id
  const { items, itemCount, subtotal, addItem, updateQuantity } = useCart()
  const [search, setSearch] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  // Deferred so rapid typing doesn't force the sidebar to re-render on every
  // keystroke — React will catch this up once the input settles.
  const deferredSearch = useDeferredValue(search)
  // While a search is active, results span all categories — don't highlight
  // the page's own category until the search box is cleared.
  const effectiveActiveCategoryId = deferredSearch.trim() ? undefined : activeCategoryId

  function closeMobileSidebar() {
    setMobileSidebarOpen(false)
  }

  // Picking a category (or "All Products") while a search is active would
  // otherwise keep showing global search results instead of that category's
  // list, since search overrides category scoping — clear it on navigation.
  function clearSearch() {
    setSearch('')
  }

  const contextValue = useMemo(
    () => ({
      branchId,
      categories,
      search,
      setSearch,
      cart: { items, itemCount, subtotal, addItem, updateQuantity },
    }),
    [branchId, categories, search, items, itemCount, subtotal, addItem, updateQuantity]
  )

  return (
    <CatalogContext.Provider value={contextValue}>
      <div className="min-h-screen flex flex-col">
        {/* ── Top Header ── */}
        <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
          <div className="max-w-7xl mx-auto px-4 lg:px-6">
            <div className="flex items-center gap-3 h-16">
              {/* Mobile menu toggle */}
              <button
                className="lg:hidden flex-shrink-0 flex items-center justify-center w-11 h-11 -ml-2 text-slate-300 hover:text-white transition-colors"
                onClick={() => setMobileSidebarOpen(v => !v)}
                aria-label="Categories"
              >
                {mobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
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
                <Link
                  href="/"
                  onClick={clearSearch}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                    !effectiveActiveCategoryId
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  All Products
                  {!effectiveActiveCategoryId && <ChevronRight className="w-3.5 h-3.5" />}
                </Link>
                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    href={categoryHref(cat.id, categories)}
                    onClick={clearSearch}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                      effectiveActiveCategoryId === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {cat.name}
                    {effectiveActiveCategoryId === cat.id && <ChevronRight className="w-3.5 h-3.5" />}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Mobile Category Sidebar (overlay) ── */}
          {/* z-50: above the header/call button/sticky cart bar (all z-40) so
              this reads as a true full-screen menu, not something other
              floating chrome can render on top of. */}
          {mobileSidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/50" onClick={closeMobileSidebar} />
              <div className="relative w-[85vw] max-w-sm bg-white h-full overflow-y-auto shadow-xl flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-slate-800 bg-slate-900 sticky top-0">
                  <p className="text-lg font-bold text-white">Categories</p>
                  <button
                    onClick={closeMobileSidebar}
                    aria-label="Close menu"
                    className="flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <nav className="p-3 space-y-1 pb-8">
                  <Link
                    href="/"
                    onClick={() => { clearSearch(); closeMobileSidebar() }}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-xl text-base font-semibold text-left transition-colors cursor-pointer ${
                      !effectiveActiveCategoryId ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    All Products
                    {!effectiveActiveCategoryId && <ChevronRight className="w-5 h-5" />}
                  </Link>
                  {categories.map(cat => (
                    <Link
                      key={cat.id}
                      href={categoryHref(cat.id, categories)}
                      onClick={() => { clearSearch(); closeMobileSidebar() }}
                      className={`w-full flex items-center justify-between px-4 py-4 rounded-xl text-base font-semibold text-left transition-colors cursor-pointer ${
                        effectiveActiveCategoryId === cat.id ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                      }`}
                    >
                      {cat.name}
                      {effectiveActiveCategoryId === cat.id && <ChevronRight className="w-5 h-5" />}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* ── Product Grid (per-route content) ── */}
          <main className="flex-1 min-w-0 pb-28 lg:pb-0">
            {children}
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
    </CatalogContext.Provider>
  )
}
