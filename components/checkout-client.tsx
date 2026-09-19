'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, X, ArrowLeft, Package, ZoomIn, Truck } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { formatPrice } from '@/components/currency'
import { optimizedImageUrl } from '@/lib/image'
import { submitOrder } from '@/app/checkout/actions'
import type { ShopSettings, FulfillmentType, ShopQrCode, ShopBankAccount } from '@/lib/types'

interface CheckoutClientProps {
  settings: ShopSettings
  qrCodes: ShopQrCode[]
  bankAccounts: ShopBankAccount[]
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900">
        <h2 className="font-semibold text-[#ffc107] text-xs uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors bg-white"

export function CheckoutClient({ settings, qrCodes, bankAccounts }: CheckoutClientProps) {
  const router = useRouter()
  const { items, subtotal, clearCart, isHydrated } = useCart()

  const [fulfillment, setFulfillment] = useState<FulfillmentType>('delivery')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [barangay, setBarangay] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [province, setProvince] = useState('')
  const [zoomedQr, setZoomedQr] = useState<ShopQrCode | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guards the empty-cart redirect below from firing when clearCart() runs
  // as part of a successful submission (see handleSubmit) - without this,
  // clearing the cart before navigating to the order confirmation page
  // races with that redirect, which can send the user home instead.
  const orderSubmittedRef = useRef(false)

  useEffect(() => {
    if (!zoomedQr) return
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomedQr(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [zoomedQr])

  useEffect(() => {
    if (isHydrated && items.length === 0 && !orderSubmittedRef.current) router.replace('/')
  }, [isHydrated, items.length, router])

  const total = subtotal

  // Don't render until localStorage is read — prevents flash redirect on mount
  if (!isHydrated || items.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await submitOrder({ name, phone, fulfillment, street, barangay, municipality, province, notes, items })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    orderSubmittedRef.current = true
    clearCart()
    router.push(`/order/${result.orderNumber}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
          <Link href="/" className="relative w-10 h-7 flex-shrink-0">
            <Image src="/syd-logo.svg" alt="SYD" fill className="object-contain" />
          </Link>
          <Link href="/cart" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-white">Checkout</h1>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        onFocus={() => setError(null)}
        onClickCapture={() => setError(null)}
        className="max-w-5xl mx-auto px-4 lg:px-6 py-6 pb-32 lg:pb-8"
      >
        <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 leading-relaxed">
            Just fill in the details below. Our staff will
            <strong> call you to confirm your order</strong>, and you can still make changes before we prepare anything.
          </p>
        </div>
        <div className="lg:grid lg:grid-cols-5 lg:gap-8">
          {/* Left: Form sections */}
          <div className="lg:col-span-3 space-y-4">

            {/* Fulfillment */}
            <SectionCard title="How would you like to receive your order?">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'delivery', label: 'Delivery', emoji: '🚚', desc: 'Delivered to your location' },
                  { value: 'pickup', label: 'Pickup', emoji: '🏪', desc: 'Collect at our store' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFulfillment(opt.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      fulfillment === opt.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <p className={`font-semibold text-sm mt-1 ${fulfillment === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Contact */}
            <SectionCard title="Contact Information">
              <div className="space-y-4">
                <Field label="Full Name" required>
                  <input required value={name} onChange={e => setName(e.target.value)}
                    placeholder="Juan dela Cruz" className={inputClass} />
                </Field>
                <Field label="Phone Number" required>
                  <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="09XX XXX XXXX" className={inputClass} />
                </Field>
              </div>
            </SectionCard>

            {/* Delivery address */}
            {fulfillment === 'delivery' && (
              <SectionCard title="Delivery Address">
                <div className="space-y-4">
                  <Field label="House / Unit / Street">
                    <input value={street} onChange={e => setStreet(e.target.value)}
                      placeholder="123 Rizal St." className={inputClass} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Barangay" required>
                      <input required={fulfillment === 'delivery'} value={barangay} onChange={e => setBarangay(e.target.value)}
                        placeholder="Brgy. Poblacion" className={inputClass} />
                    </Field>
                    <Field label="Municipality / City" required>
                      <input required={fulfillment === 'delivery'} value={municipality} onChange={e => setMunicipality(e.target.value)}
                        placeholder="Talakag" className={inputClass} />
                    </Field>
                  </div>
                  <Field label="Province">
                    <input value={province} onChange={e => setProvince(e.target.value)}
                      placeholder="Bukidnon" className={inputClass} />
                  </Field>
                </div>
              </SectionCard>
            )}

            {/* Delivery fee note */}
            {fulfillment === 'delivery' && (
              <SectionCard title="Delivery Fee">
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                  <Truck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Delivery fee will be calculated and confirmed by our staff when they reach out to finalize your order.
                  </p>
                </div>
              </SectionCard>
            )}

            {/* Payment — informational only, no selection needed here */}
            <SectionCard title="Accepted Payment Methods">
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  You don&apos;t need to pay yet — just note which option works for you. Staff will send a secure
                  payment link once your order is finalized, where you can pick a method and confirm payment.
                </p>

                {qrCodes.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {qrCodes.map(qr => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => setZoomedQr(qr)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-colors cursor-zoom-in"
                      >
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-50 border border-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qr.image_url} alt={qr.label} className="w-full h-full object-contain" />
                          <span className="absolute bottom-1 right-1 bg-slate-900/70 text-white rounded-full p-1">
                            <ZoomIn className="w-3 h-3" />
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 text-center">{qr.label}</p>
                      </button>
                    ))}
                  </div>
                )}

                {bankAccounts.length > 0 && (
                  <div className="space-y-2">
                    {bankAccounts.map(account => (
                      <div key={account.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-blue-900 text-xs uppercase tracking-wide mb-1">{account.bank_name}</p>
                        <p className="text-blue-900 font-medium">{account.account_name}</p>
                        <p className="text-blue-700">{account.account_number}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Notes */}
            <SectionCard title="Order Notes (Optional)">
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Special instructions, landmarks, or other notes for the staff..."
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </SectionCard>
          </div>

          {/* Right: Order summary (desktop sticky) */}
          <div className="hidden lg:block lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900">
                  <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">Order Summary</h2>
                </div>
                <div className="p-5 space-y-3">
                  {items.map(item => (
                    <div key={item.product_id} className="flex gap-3">
                      <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                        {item.image_url ? (
                          <Image src={optimizedImageUrl(item.image_url, { width: 120 })} alt={item.product_name} fill className="object-cover" unoptimized />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug">{item.product_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">×{item.quantity} {item.unit_label}</p>
                      </div>
                      <p className="text-xs font-bold text-slate-900 flex-shrink-0">{formatPrice(item.unit_price * item.quantity)}</p>
                    </div>
                  ))}

                  <div className="border-t border-slate-100 pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    {fulfillment === 'delivery' && (
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Delivery fee</span>
                        <span className="italic text-slate-400">To be confirmed</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                      <span>{fulfillment === 'delivery' ? 'Subtotal' : 'Total'}</span>
                      <span className="text-[#ffc107] text-base">{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff contact notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-blue-900 mb-1">What happens next?</p>
                <p className="text-blue-800 text-xs leading-relaxed">
                  After placing your order, our staff will contact you at <strong>{phone || 'your number'}</strong> to confirm.
                  {settings.store_hours && <span className="block mt-1 text-blue-600">Hours: {settings.store_hours}</span>}
                </p>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-sm transition-colors shadow-md">
                {submitting ? 'Placing Order...' : `Place Order · ${formatPrice(total)}`}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile order summary */}
        <div className="lg:hidden mt-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
              <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">Order Summary</h2>
            </div>
            <div className="p-4 space-y-2">
              {items.map(item => (
                <div key={item.product_id} className="flex justify-between text-xs text-slate-600">
                  <span className="truncate pr-2">{item.product_name} ×{item.quantity}</span>
                  <span className="font-medium flex-shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 space-y-1">
                {fulfillment === 'delivery' && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Delivery fee</span>
                    <span className="italic text-slate-400">To be confirmed</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{fulfillment === 'delivery' ? 'Subtotal' : 'Total'}</span>
                  <span className="text-[#ffc107]">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            Our staff will contact you at <strong>{phone || 'your number'}</strong> to confirm your order.
            {settings.store_hours && <span className="block mt-0.5 text-blue-600">Hours: {settings.store_hours}</span>}
          </div>
        </div>
      </form>

      {/* Mobile submit bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 p-3 shadow-lg">
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit as any}
          className="w-full bg-[#ffc107] hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold py-3.5 rounded-xl text-sm transition-colors"
        >
          {submitting ? 'Placing Order...' : `Place Order · ${formatPrice(total)}`}
        </button>
      </div>

      {/* Fullscreen QR zoom */}
      {zoomedQr && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setZoomedQr(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedQr(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomedQr.image_url}
              alt={zoomedQr.label}
              className="w-[min(85vw,420px)] aspect-square object-contain rounded-xl bg-white"
            />
            <p className="text-sm text-white/80">{zoomedQr.label}</p>
          </div>
        </div>
      )}

      {/* Floating validation prompt — sits above the mobile submit bar,
          dismisses itself as soon as the customer starts fixing the
          form (focusing or clicking anything in it), or can be closed
          manually. */}
      {error && (
        <div className="fixed inset-x-4 bottom-24 lg:bottom-6 lg:left-auto lg:right-6 lg:inset-x-auto lg:w-96 z-50">
          <div className="flex items-start gap-3 bg-red-600 text-white rounded-xl shadow-lg p-4">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm flex-1 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex-shrink-0 text-white/80 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
