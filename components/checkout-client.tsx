'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, X, ArrowLeft, Package, Truck, ClipboardList } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { useContact } from '@/lib/contact'
import { formatPrice } from '@/components/currency'
import { optimizedImageUrl } from '@/lib/image'
import { submitOrder } from '@/app/review/actions'
import { pushDataLayerEvent } from '@/lib/analytics'
import type { ShopSettings, FulfillmentType } from '@/lib/types'

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
  const { items, subtotal, clearCart, isHydrated } = useCart()
  const { contact, saveContact, isHydrated: contactHydrated } = useContact()

  const [fulfillment, setFulfillment] = useState<FulfillmentType>('delivery')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [barangay, setBarangay] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [province, setProvince] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Prefill from what this browser already saved (the welcome form, or the
  // last request). Once, after storage is read, so typing isn't overwritten.
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (!contactHydrated || prefilledRef.current) return
    prefilledRef.current = true
    if (!contact) return
    setName(contact.name ?? '')
    setPhone(contact.phone ?? '')
    if (contact.fulfillment) setFulfillment(contact.fulfillment)
    setStreet(contact.street ?? '')
    setBarangay(contact.barangay ?? '')
    setMunicipality(contact.municipality ?? '')
    setProvince(contact.province ?? '')
  }, [contactHydrated, contact])

  // Guards the empty-cart redirect below from firing when clearCart() runs
  // as part of a successful submission (see handleSubmit) - without this,
  // clearing the cart before navigating to the order confirmation page
  // races with that redirect, which can send the user home instead.
  const orderSubmittedRef = useRef(false)

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

    // Photo previews (data URLs) are only for the browser; the server gets
    // the stored photo paths.
    const payloadItems = items.map((i) => (i.special ? { ...i, special: { ...i.special, thumbs: [] } } : i))
    const result = await submitOrder({
      name, phone, fulfillment, street, barangay, municipality, province, notes, items: payloadItems,
      leadId: contact?.leadId, leadToken: contact?.leadToken,
    })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    // Keep the details for next time; the lead (if any) is used up.
    saveContact({
      name: name.trim(), phone, fulfillment, street, barangay, municipality, province,
      leadId: undefined, leadToken: undefined,
    })

    orderSubmittedRef.current = true

    // Primary conversion event — deliberately "lead", not "purchase": no
    // payment has been confirmed at this point, only an order intent.
    // Fired here (not server-side in submitOrder) because dataLayer needs
    // the browser, and this is the one moment guaranteed to happen inside
    // the same session as whatever ad/channel brought the customer here.
    pushDataLayerEvent('generate_lead', {
      // Same ID the server sends to Meta's Conversions API, so Meta counts
      // this lead once (GTM's Meta tag must pass it as the Event ID).
      event_id: `lead-${result.orderNumber}`,
      currency: 'PHP',
      value: subtotal,
      transaction_id: result.orderNumber,
      items: items.map(i => ({ item_id: i.product_id, item_name: i.product_name, price: i.unit_price, quantity: i.quantity })),
    })

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
          <Link href="/list" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-white">Review Your List</h1>
        </div>
      </header>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onFocus={() => setError(null)}
        onClickCapture={() => setError(null)}
        className="max-w-5xl mx-auto px-4 lg:px-6 py-6 pb-32 lg:pb-8"
      >
        <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 leading-relaxed">
            {settings.hide_prices ? (
              <>Check your list and details below. Our staff will<strong> call you with pricing to confirm your request</strong>, and nothing is final until then.</>
            ) : (
              <>Check your list and details below. Our staff will<strong> call you to confirm prices, stock and delivery</strong>, and you can still make changes before we prepare anything.</>
            )}
          </p>
        </div>
        <div className="lg:grid lg:grid-cols-5 lg:gap-8">
          {/* Left: Form sections */}
          <div className="lg:col-span-3 space-y-4">

            {/* Fulfillment */}
            <SectionCard title="How would you like to get your items?">
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
                    Delivery fee will be calculated and confirmed by our staff when they reach out about your request.
                  </p>
                </div>
              </SectionCard>
            )}

            {/* Notes */}
            <SectionCard title="Notes for Our Team (Optional)">
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
                  <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">List Summary</h2>
                </div>
                <div className="p-5 space-y-3">
                  {items.map(item => (
                    <div key={item.product_id} className="flex gap-3">
                      <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                        {item.special?.thumbs[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.special.thumbs[0]} alt="" className="w-full h-full object-cover" />
                        ) : item.image_url ? (
                          <Image src={optimizedImageUrl(item.image_url, { width: 120 })} alt={item.product_name} fill className="object-cover" unoptimized />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            {item.special ? <ClipboardList className="w-5 h-5 text-blue-300" /> : <Package className="w-5 h-5 text-slate-300" />}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug">{item.product_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          ×{item.quantity} {item.unit_label}
                          {item.special && <span className="ml-1 text-blue-700 font-medium">· special request</span>}
                        </p>
                      </div>
                      {!settings.hide_prices && (
                        <p className="text-xs font-bold text-slate-900 flex-shrink-0">
                          {item.special ? <span className="font-medium text-blue-700">Quote</span> : formatPrice(item.unit_price * item.quantity)}
                        </p>
                      )}
                    </div>
                  ))}

                  {!settings.hide_prices && (
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
                  )}
                </div>
              </div>

              {/* Staff contact notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-blue-900 mb-1">What happens next?</p>
                <p className="text-blue-800 text-xs leading-relaxed">
                  {settings.hide_prices
                    ? <>After submitting your request, our staff will contact you at <strong>{phone || 'your number'}</strong> with pricing and availability.</>
                    : <>After you submit, our staff will contact you at <strong>{phone || 'your number'}</strong> to confirm.</>}
                  <span className="block mt-1">You don&apos;t need to pay yet. Once everything is confirmed, we&apos;ll send you a secure payment link.</span>
                  {settings.store_hours && <span className="block mt-1 text-blue-600">Hours: {settings.store_hours}</span>}
                </p>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-sm transition-colors shadow-md">
                {settings.hide_prices
                  ? (submitting ? 'Sending...' : 'Submit Request')
                  : (submitting ? 'Sending...' : `Submit Request · ${formatPrice(total)}`)}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile order summary */}
        <div className="lg:hidden mt-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
              <h2 className="font-bold text-[#ffc107] text-xs uppercase tracking-wide">List Summary</h2>
            </div>
            <div className="p-4 space-y-2">
              {items.map(item => (
                <div key={item.product_id} className="flex justify-between text-xs text-slate-600">
                  <span className="truncate pr-2">{item.product_name} ×{item.quantity}</span>
                  {!settings.hide_prices && (
                    <span className="font-medium flex-shrink-0">{item.special ? 'Quote' : formatPrice(item.unit_price * item.quantity)}</span>
                  )}
                </div>
              ))}
              {!settings.hide_prices && (
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
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            {settings.hide_prices
              ? <>Our staff will contact you at <strong>{phone || 'your number'}</strong> with pricing and availability.</>
              : <>Our staff will contact you at <strong>{phone || 'your number'}</strong> to confirm your request.</>}
            <span className="block mt-0.5">No payment needed yet. We&apos;ll send a payment link once it&apos;s confirmed.</span>
            {settings.store_hours && <span className="block mt-0.5 text-blue-600">Hours: {settings.store_hours}</span>}
          </div>
        </div>
      </form>

      {/* Mobile submit bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 p-3 shadow-lg">
        <button
          type="button"
          disabled={submitting}
          // requestSubmit runs the browser's required-field checks, which a
          // direct handleSubmit call outside the form would skip.
          onClick={() => formRef.current?.requestSubmit()}
          className="w-full bg-[#ffc107] hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold py-3.5 rounded-xl text-sm transition-colors"
        >
          {settings.hide_prices
            ? (submitting ? 'Sending...' : 'Submit Request')
            : (submitting ? 'Sending...' : `Submit Request · ${formatPrice(total)}`)}
        </button>
      </div>

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
