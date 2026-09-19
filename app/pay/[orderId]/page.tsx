import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { getShopQrCodes, getShopBankAccounts } from '@/lib/supabase/queries/shop-settings'
import { formatPrice } from '@/components/currency'
import { PaymentMethodPicker } from '@/components/payment-method-picker'

interface Props {
  params: Promise<{ orderId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderId } = await params
  return { title: `Payment — Order ${orderId.slice(0, 8)}` }
}

export default async function PaymentPage({ params }: Props) {
  const { orderId } = await params

  const supabase = createServerClient()
  const [{ data: order }, qrCodes, bankAccounts] = await Promise.all([
    supabase
      .from('online_orders')
      .select('*, lines:online_order_lines(product_id, product_name, quantity, unit_label, unit_price, line_total)')
      .eq('id', orderId)
      .single(),
    getShopQrCodes(),
    getShopBankAccounts(),
  ])

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-slate-500">Order not found.</p>
        <Link href="/" className="text-blue-600 text-sm font-medium">Back to Shop</Link>
      </div>
    )
  }

  // distance_km is only ever set once staff finalize a delivery order's
  // location/fee in syd-pos — if it's still null, the fee genuinely isn't
  // finalized yet, regardless of what delivery_fee currently holds (0).
  const feeFinalized = order.fulfillment !== 'delivery' || order.distance_km != null
  const alreadySubmitted = order.payment_status !== 'unpaid'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="relative w-10 h-7">
            <Image src="/syd-logo.svg" alt="SYD" fill className="object-contain" />
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 pb-16 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Complete Your Payment</h1>
          <p className="text-slate-500 text-sm mt-1">
            Order <span className="font-mono">{order.order_number}</span>
            {order.customer_name ? ` — ${order.customer_name}` : ''}
          </p>
        </div>

        {/* Order details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900">
            <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">Order Summary</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {(order.lines ?? []).map((line: { product_id: string | null; product_name: string; quantity: number; unit_label: string; line_total: number }, i: number) => (
                <div key={line.product_id ?? i} className="flex justify-between text-sm">
                  <span className="text-slate-700 flex-1 truncate pr-2">
                    <Package className="w-3.5 h-3.5 inline mr-1.5 text-slate-300" />
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
                  <span>{feeFinalized ? formatPrice(order.delivery_fee) : 'To be confirmed'}</span>
                </div>
              )}
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                <span>Total</span>
                <span className="text-[#ffc107] text-base">{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900">
            <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">Pay Now</h2>
          </div>
          <div className="p-5">
            {!feeFinalized ? (
              <p className="text-sm text-slate-500">
                Your delivery fee is still being finalized — please wait for staff to confirm before paying, or check back on this same link shortly.
              </p>
            ) : alreadySubmitted ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-700">
                  Payment info already submitted
                  {order.payment_method && <> via <span className="capitalize font-medium">{order.payment_method.replace('_', ' ')}</span></>}.
                </p>
                {order.payment_reference_no && <p className="text-slate-500">Reference: {order.payment_reference_no}</p>}
                <p className="text-slate-400 text-xs">Need to fix something? Submitting again below will update your info.</p>
                <div className="pt-2">
                  <PaymentMethodPicker orderId={order.id} qrCodes={qrCodes} bankAccounts={bankAccounts} />
                </div>
              </div>
            ) : (
              <PaymentMethodPicker orderId={order.id} qrCodes={qrCodes} bankAccounts={bankAccounts} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
