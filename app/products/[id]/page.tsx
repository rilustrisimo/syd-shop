'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Package, ShoppingCart, Plus, Minus, AlertCircle, Tag, ChevronRight } from 'lucide-react'
import { getProductById } from '@/lib/supabase/queries/products'
import { getPublicShopSettings } from '@/lib/supabase/queries/shop-settings'
import { useCart } from '@/lib/cart'
import { formatPrice } from '@/components/currency'
import { QtyInput } from '@/components/qty-input'
import { optimizedImageUrl } from '@/lib/image'
import type { ShopProductDetail } from '@/lib/types'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { items, itemCount, subtotal, addItem, updateQuantity } = useCart()
  const [product, setProduct] = useState<ShopProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)

  useEffect(() => {
    async function load() {
      const settings = await getPublicShopSettings()
      const branchId = settings?.branch_id ?? ''
      const data = await getProductById(id, branchId)
      setProduct(data)
      setLoading(false)
      if (data) document.title = `${data.name} · SYD Construction Supplies`
    }
    load()
  }, [id])

  const cartQty = items.find(i => i.product_id === id)?.quantity ?? 0

  function handleAdd() {
    if (!product) return
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-16 bg-slate-900 border-b border-slate-800 animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
          <div className="lg:grid lg:grid-cols-2 lg:gap-10">
            <div className="aspect-square bg-slate-100 rounded-2xl animate-pulse" />
            <div className="mt-6 lg:mt-0 space-y-4">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-1/3" />
              <div className="h-7 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-9 bg-slate-100 rounded animate-pulse w-1/2" />
              <div className="h-20 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Package className="w-14 h-14 opacity-40" />
        <p className="text-sm">Product not found</p>
        <Link href="/" className="text-blue-600 text-sm font-medium">Back to catalog</Link>
      </div>
    )
  }

  const images = product.images.length > 0
    ? product.images
    : product.primary_image_url
      ? [{ url: product.primary_image_url, alt_text: null, is_primary: true, sort_order: 0 }]
      : []

  return (
    <div className="min-h-screen bg-slate-50 pb-32 lg:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
          <Link href="/" className="relative w-10 h-7 flex-shrink-0">
            <Image src="/syd-logo.svg" alt="SYD" fill className="object-contain" />
          </Link>
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 flex-1 min-w-0">
            <Link href="/" className="hover:text-[#ffc107] transition-colors">All Products</Link>
            {product.category_name && (
              <>
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-slate-300 truncate">{product.category_name}</span>
              </>
            )}
          </div>
          <Link href="/cart" className="relative ml-auto flex items-center gap-2 text-slate-400 hover:text-[#ffc107] transition-colors">
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#ffc107] text-slate-900 text-[10px] font-bold rounded-full min-w-[1.1rem] min-h-[1.1rem] flex items-center justify-center px-1">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
        <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">

          {/* Left: Image gallery */}
          <div>
            <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              {images.length > 0 ? (
                <Image
                  src={optimizedImageUrl(images[selectedImage]?.url ?? images[0].url, { width: 800 })}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  unoptimized
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="w-20 h-20 text-slate-200" />
                </div>
              )}
              {!product.in_stock && (
                <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-6">
                  <span className="text-white font-semibold text-sm bg-black/60 px-4 py-2 rounded-full">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                      selectedImage === i ? 'border-blue-500' : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <Image src={optimizedImageUrl(img.url, { width: 150 })} alt={`View ${i + 1}`} fill className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product info + actions */}
          <div className="mt-6 lg:mt-0 space-y-5">
            {/* Mobile breadcrumb */}
            <div className="sm:hidden flex items-center gap-1.5 text-xs text-slate-400">
              <Link href="/" className="hover:text-blue-600">All Products</Link>
              {product.category_name && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span>{product.category_name}</span>
                </>
              )}
            </div>

            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 leading-snug">{product.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                <Tag className="w-3.5 h-3.5" />
                <span>{product.code}</span>
                {product.subcategory_name && (
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{product.subcategory_name}</span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#ffc107]">{formatPrice(product.current_selling_price)}</span>
              <span className="text-sm text-slate-400">per {product.unit_label}</span>
            </div>

            {/* Stock status */}
            {product.in_stock ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                In Stock
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs font-medium">
                  Currently out of stock — you can still order it on request. Staff will confirm availability and delivery timing when they call.
                </p>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Desktop: Add to cart inline */}
            <div className="hidden lg:block">
              {cartQty === 0 ? (
                <button
                  onClick={handleAdd}
                  className={`w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm ${
                    product.in_stock ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  {product.in_stock ? 'Add to Cart' : 'Request This Item'}
                </button>
              ) : (
                <div className="space-y-3">
                  {!product.in_stock && (
                    <p className="text-xs font-semibold text-amber-600 text-center">On Request — staff will confirm availability</p>
                  )}
                  <div className={`flex items-center justify-between rounded-xl px-5 py-3 border ${
                    product.in_stock ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <button
                      onClick={() => updateQuantity(product.id, cartQty - 1)}
                      className={`w-9 h-9 flex items-center justify-center rounded-full bg-white border transition-colors ${
                        product.in_stock ? 'border-blue-300 text-blue-600 hover:bg-blue-100' : 'border-amber-300 text-amber-600 hover:bg-amber-100'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className={`flex items-center gap-1.5 text-xl font-bold ${product.in_stock ? 'text-blue-700' : 'text-amber-700'}`}>
                      <QtyInput
                        value={cartQty}
                        onChange={(v) => updateQuantity(product.id, v)}
                        className="w-20 text-center"
                      />
                      in cart
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, cartQty + 1)}
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-white transition-colors ${
                        product.in_stock ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <Link
                    href="/cart"
                    className="flex items-center justify-center gap-2 w-full bg-[#ffc107] hover:bg-amber-400 text-slate-900 font-bold py-3.5 rounded-xl transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    View Cart · {formatPrice(subtotal)}
                  </Link>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-base">🚚</p>
                  <p className="text-xs font-semibold text-slate-700 mt-1">Home Delivery</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">₱50 within 3km</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-base">🏪</p>
                  <p className="text-xs font-semibold text-slate-700 mt-1">Store Pickup</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Free — COD accepted</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: sticky add to cart bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-4 py-3 shadow-lg">
        {cartQty === 0 ? (
          <button
            onClick={handleAdd}
            className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors ${
              product.in_stock ? 'bg-[#ffc107] hover:bg-amber-400 text-slate-900' : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            <Plus className="w-5 h-5" />
            {product.in_stock ? 'Add to Cart' : 'Request This Item'}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-3 border rounded-xl px-3 py-2 ${
              product.in_stock ? 'bg-blue-900/30 border-blue-700' : 'bg-amber-900/30 border-amber-700'
            }`}>
              <button
                onClick={() => updateQuantity(product.id, cartQty - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:text-white"
              >
                <Minus className="w-4 h-4" />
              </button>
              <QtyInput
                value={cartQty}
                onChange={(v) => updateQuantity(product.id, v)}
                className="text-lg font-bold text-white w-14 text-center"
              />
              <button
                onClick={() => updateQuantity(product.id, cartQty + 1)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-white ${
                  product.in_stock ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-500 hover:bg-amber-400'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <Link
              href="/cart"
              className="flex-1 bg-[#ffc107] hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              View Cart · {formatPrice(subtotal)}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
