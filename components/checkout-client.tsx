'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, AlertTriangle, CheckCircle, Upload, X, ArrowLeft, Package } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { calcDelivery } from '@/lib/haversine'
import { formatPrice } from '@/components/currency'
import { submitOrder } from '@/app/checkout/actions'
import type { ShopSettings, FulfillmentType, PaymentMethod, DeliveryCalc } from '@/lib/types'

const DeliveryMap = dynamic(() => import('@/components/delivery-map').then(m => ({ default: m.DeliveryMap })), {
  ssr: false,
  loading: () => <div className="w-full h-64 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />,
})

interface CheckoutClientProps {
  settings: ShopSettings
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

export function CheckoutClient({ settings }: CheckoutClientProps) {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()

  const [fulfillment, setFulfillment] = useState<FulfillmentType>('delivery')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [barangay, setBarangay] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [province, setProvince] = useState('')
  const [pinLat, setPinLat] = useState<number | null>(null)
  const [pinLng, setPinLng] = useState<number | null>(null)
  const [deliveryCalc, setDeliveryCalc] = useState<DeliveryCalc | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')
  const [referenceNo, setReferenceNo] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proofInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (fulfillment !== 'delivery' || pinLat == null || pinLng == null) {
      setDeliveryCalc(null)
      return
    }
    const calc = calcDelivery(pinLat, pinLng, settings)
    setDeliveryCalc(calc)
    if (!calc.cod_available && paymentMethod === 'cod') {
      setPaymentMethod('gcash')
    }
  }, [pinLat, pinLng, fulfillment, settings])

  useEffect(() => {
    if (fulfillment === 'pickup') setPaymentMethod('cod')
  }, [fulfillment])

  useEffect(() => {
    if (items.length === 0) router.replace('/')
  }, [items.length, router])

  const delivery_fee = fulfillment === 'delivery' ? (deliveryCalc?.delivery_fee ?? 0) : 0
  const total = subtotal + delivery_fee
  const needsProof = ['gcash', 'bank_transfer', 'qr'].includes(paymentMethod)

  if (items.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    let proofFormData: FormData | null = null
    if (proofFile) {
      proofFormData = new FormData()
      proofFormData.append('proof', proofFile)
    }

    const result = await submitOrder(
      { name, phone, fulfillment, street, barangay, municipality, province, pinLat, pinLng, paymentMethod, referenceNo, notes, items },
      proofFormData
    )

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

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

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 lg:px-6 py-6 pb-32 lg:pb-8">
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

            {/* Map pin */}
            {fulfillment === 'delivery' && (
              <SectionCard title="Pin Your Exact Delivery Location">
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      <strong>Important:</strong> We only deliver to your pinned location. Pin accurately so your delivery fee is calculated correctly.
                    </p>
                  </div>
                  <DeliveryMap
                    storeLat={settings.store_latitude}
                    storeLng={settings.store_longitude}
                    onPin={(lat, lng) => { setPinLat(lat); setPinLng(lng) }}
                    pinLat={pinLat}
                    pinLng={pinLng}
                  />
                  {deliveryCalc ? (
                    <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                      deliveryCalc.cod_available
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>
                        <strong>{deliveryCalc.distance_km} km</strong> from store
                        {' · '}
                        Delivery fee: <strong>{formatPrice(deliveryCalc.delivery_fee)}</strong>
                        {deliveryCalc.cod_available
                          ? ' · ✅ COD available'
                          : ' · 💳 COD not available at this distance'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-1">Tap on the map to pin your delivery location</p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Payment */}
            <SectionCard title="Payment Method">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'cod', label: 'Cash on Delivery', emoji: '💵', disabled: fulfillment === 'delivery' && deliveryCalc != null && !deliveryCalc.cod_available },
                    { value: 'gcash', label: 'GCash', emoji: '📱', disabled: false },
                    { value: 'bank_transfer', label: 'Bank Transfer', emoji: '🏦', disabled: false },
                    { value: 'qr', label: 'QR Code', emoji: '📷', disabled: false },
                  ] as { value: PaymentMethod; label: string; emoji: string; disabled: boolean }[]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && setPaymentMethod(opt.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        paymentMethod === opt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-blue-200'
                      }`}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <p className={`text-xs font-semibold mt-1 ${paymentMethod === opt.value ? 'text-blue-700' : 'text-slate-600'}`}>
                        {opt.label}
                      </p>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'gcash' && settings.gcash_number && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-blue-900 text-xs uppercase tracking-wide mb-1">Send GCash to</p>
                    <p className="text-blue-900 font-medium">{settings.gcash_name}</p>
                    <p className="text-blue-700">{settings.gcash_number}</p>
                  </div>
                )}
                {paymentMethod === 'bank_transfer' && settings.bank_account_no && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-blue-900 text-xs uppercase tracking-wide mb-1">{settings.bank_name}</p>
                    <p className="text-blue-900 font-medium">{settings.bank_account_name}</p>
                    <p className="text-blue-700">{settings.bank_account_no}</p>
                  </div>
                )}
                {paymentMethod === 'qr' && settings.qr_code_url && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={settings.qr_code_url} alt="QR Code" className="w-48 h-48 object-contain rounded-xl border border-slate-200" />
                    <p className="text-xs text-slate-500">Scan to pay</p>
                  </div>
                )}

                {needsProof && (
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <Field label="Reference / Confirmation Number">
                      <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                        placeholder="e.g. GCash ref 1234567890" className={inputClass} />
                    </Field>
                    <Field label="Upload Payment Screenshot">
                      <input ref={proofInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                      {proofFile ? (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-700 flex-1 truncate font-medium">{proofFile.name}</span>
                          <button type="button" onClick={() => setProofFile(null)} className="text-slate-400 hover:text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => proofInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg py-4 flex flex-col items-center gap-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                          <Upload className="w-5 h-5" />
                          <span className="text-xs font-medium">Tap to upload proof of payment</span>
                        </button>
                      )}
                    </Field>
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
                          <Image src={item.image_url} alt={item.product_name} fill className="object-cover" unoptimized />
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
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Delivery fee</span>
                      <span>{fulfillment === 'pickup' ? 'Free' : deliveryCalc ? formatPrice(delivery_fee) : 'Pending pin'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                      <span>Total</span>
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

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

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
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Delivery fee</span>
                  <span>{fulfillment === 'pickup' ? 'Free' : deliveryCalc ? formatPrice(delivery_fee) : 'Pending'}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Total</span>
                  <span className="text-[#ffc107]">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            Our staff will contact you at <strong>{phone || 'your number'}</strong> to confirm your order.
            {settings.store_hours && <span className="block mt-0.5 text-blue-600">Hours: {settings.store_hours}</span>}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}
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
    </div>
  )
}
