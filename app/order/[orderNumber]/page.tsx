import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle, Phone, Clock, Package, MapPin } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { getPublicShopSettings } from '@/lib/supabase/queries/shop-settings'
import { formatPrice } from '@/components/currency'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params
  return { title: `Order ${orderNumber} Confirmed` }
}

interface Props {
  params: Promise<{ orderNumber: string }>
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderNumber } = await params

  const supabase = createServerClient()
  const [{ data: order }, settings] = await Promise.all([
    supabase
      .from('online_orders')
      .select('*, lines:online_order_lines(product_name, quantity, unit_label, unit_price, line_total)')
      .eq('order_number', orderNumber)
      .single(),
    getPublicShopSettings(),
  ])

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-slate-500">Order not found.</p>
        <Link href="/" className="text-blue-600 text-sm font-medium">Back to Shop</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="relative w-10 h-7">
            <Image src="/syd-logo.svg" alt="SYD" fill className="object-contain" />
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 pb-16 space-y-4">
        {/* Success header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Order Placed!</h1>
            <p className="text-slate-500 text-sm mt-1">Thank you for your order</p>
          </div>
          <div className="inline-block bg-slate-900 border border-slate-700 rounded-xl px-5 py-2">
            <p className="text-xs text-[#ffc107]/70 font-medium uppercase tracking-wide">Order Number</p>
            <p className="text-xl font-bold text-[#ffc107] font-mono mt-0.5">{order.order_number}</p>
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900">
            <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">What happens next?</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Staff will contact you</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  We'll call or text <strong>{order.customer_phone}</strong> to confirm your order.
                </p>
              </div>
            </div>
            {settings?.store_hours && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Business hours</p>
                  <p className="text-xs text-slate-500 mt-0.5">{settings.store_hours}</p>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                {order.fulfillment === 'delivery' ? (
                  <Package className="w-4 h-4 text-green-600" />
                ) : (
                  <MapPin className="w-4 h-4 text-green-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {order.fulfillment === 'delivery' ? 'Delivery' : 'Store Pickup'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {order.fulfillment === 'delivery'
                    ? order.address
                      ? `Delivering to: ${order.address}`
                      : "We'll prepare your order for delivery to your pinned location."
                    : 'Visit our store to pick up your order once it\'s ready.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Order details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900">
            <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">Order Details</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {(order.lines ?? []).map((line: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700 flex-1 truncate pr-2">
                    {line.product_name}
                    <span className="text-slate-400 ml-1">× {line.quantity} {line.unit_label}</span>
                  </span>
                  <span className="font-medium text-slate-900 flex-shrink-0">{formatPrice(line.line_total)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 mt-4 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.fulfillment === 'delivery' && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Delivery fee{order.distance_km ? ` (${order.distance_km} km)` : ''}</span>
                  <span>{formatPrice(order.delivery_fee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                <span>Total</span>
                <span className="text-[#ffc107] text-base">{formatPrice(order.total_amount)}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 space-y-1">
              <p>Payment: <span className="capitalize text-slate-600">{order.payment_method.replace('_', ' ')}</span></p>
              {order.payment_reference_no && (
                <p>Reference: <span className="text-slate-600">{order.payment_reference_no}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Questions */}
        {settings?.store_phone && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-blue-900">Questions?</p>
            <p className="text-blue-800 mt-0.5">
              Call or text us: <a href={`tel:${settings.store_phone}`} className="font-bold underline">{settings.store_phone}</a>
            </p>
            {settings.store_address && (
              <p className="text-blue-600 text-xs mt-1">{settings.store_address}</p>
            )}
          </div>
        )}

        <Link
          href="/"
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-sm"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
