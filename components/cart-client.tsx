'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Package, Trash2, Plus, Minus, ShoppingBag, ShoppingCart, Clock } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { getStockMap } from '@/lib/supabase/queries/products'
import { formatPrice } from '@/components/currency'

interface CartClientProps {
  branchId: string
}

export function CartClient({ branchId }: CartClientProps) {
  const { items, itemCount, subtotal, updateQuantity, removeItem, clearCart } = useCart()
  const [stock, setStock] = useState<Record<string, number>>({})

  useEffect(() => {
    document.title = itemCount > 0
      ? `Cart (${itemCount}) · SYD Construction Supplies`
      : 'Cart · SYD Construction Supplies'
  }, [itemCount])

  useEffect(() => {
    if (items.length === 0 || !branchId) return
    getStockMap(items.map(i => i.product_id), branchId).then(setStock)
  }, [items, branchId])

  function isRequest(productId: string, quantity: number) {
    return quantity > (stock[productId] ?? 0)
  }

  const requestCount = items.filter(i => isRequest(i.product_id, i.quantity)).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
          <Link href="/" className="relative w-10 h-7 flex-shrink-0">
            <Image src="/syd-logo.svg" alt="SYD" fill className="object-contain" />
          </Link>
          <div className="flex-1 flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-white">
              Cart {itemCount > 0 && <span className="text-slate-400 font-normal text-sm">({itemCount} items)</span>}
            </h1>
          </div>
          {itemCount > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </header>

      {itemCount === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-slate-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-700 mb-1">Your cart is empty</h2>
            <p className="text-sm text-slate-400">Add products from the catalog to get started.</p>
          </div>
          <Link
            href="/"
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 pb-32 lg:pb-6">
          {requestCount > 0 && (
            <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>{requestCount} item{requestCount > 1 ? 's are' : ' is'} on request</strong> — not currently in stock.
                Staff will confirm availability and delivery timing when they call to verify your order.
              </p>
            </div>
          )}

          <div className="lg:grid lg:grid-cols-3 lg:gap-6">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-3">
              {items.map(item => {
                const requested = isRequest(item.product_id, item.quantity)
                return (
                  <div key={item.product_id} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 shadow-sm">
                    {/* Image */}
                    <Link href={`/products/${item.product_id}`} className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.product_name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <Link href={`/products/${item.product_id}`} className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-2 hover:text-blue-600 transition-colors">
                            {item.product_name}
                          </p>
                        </Link>
                        {requested && (
                          <span className="flex-shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                            On Request
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatPrice(item.unit_price)} per {item.unit_label}</p>

                      <div className="flex items-center justify-between mt-3">
                        {/* Qty stepper */}
                        <div className={`flex items-center gap-2 rounded-lg px-2 py-1 border ${
                          requested ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                        }`}>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-white ${
                              requested ? 'text-amber-600 hover:text-amber-700' : 'text-blue-600 hover:text-blue-700'
                            }`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className={`text-sm font-bold w-6 text-center ${requested ? 'text-amber-900' : 'text-blue-900'}`}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className={`w-6 h-6 flex items-center justify-center rounded-md text-white transition-colors ${
                              requested ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <p className="text-sm font-bold text-slate-900">
                            {formatPrice(item.unit_price * item.quantity)}
                          </p>
                          <button
                            onClick={() => removeItem(item.product_id)}
                            className="text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              <Link
                href="/"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium pt-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Continue Shopping
              </Link>
            </div>

            {/* Order summary — desktop sidebar */}
            <div className="hidden lg:block">
              <div className="sticky top-24 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-900">
                  <h2 className="font-bold text-[#ffc107] text-sm uppercase tracking-wide">Order Summary</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-xs">
                      <span>Delivery fee</span>
                      <span>Calculated at checkout</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex justify-between font-bold text-slate-900">
                    <span>Subtotal</span>
                    <span className="text-[#ffc107] text-base">{formatPrice(subtotal)}</span>
                  </div>
                  {requestCount > 0 && (
                    <p className="text-[11px] text-amber-600">
                      Includes {requestCount} item{requestCount > 1 ? 's' : ''} on request — total shown assumes full quantity is fulfilled.
                    </p>
                  )}
                  <Link
                    href="/checkout"
                    className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors"
                  >
                    Proceed to Checkout
                  </Link>
                  <p className="text-xs text-slate-400 text-center">
                    Delivery fee calculated based on your location
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom checkout bar */}
      {itemCount > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm text-slate-400">Subtotal</span>
            <span className="font-bold text-[#ffc107]">{formatPrice(subtotal)}</span>
          </div>
          <Link
            href="/checkout"
            className="flex items-center justify-center gap-2 w-full bg-[#ffc107] hover:bg-amber-400 text-slate-900 font-bold py-3.5 rounded-xl transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Proceed to Checkout
          </Link>
        </div>
      )}
    </div>
  )
}
