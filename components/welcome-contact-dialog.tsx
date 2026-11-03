'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CheckCircle, Loader2, Phone, X } from 'lucide-react'
import { useContact, isContactPromptDismissed, dismissContactPrompt } from '@/lib/contact'
import { isValidPhMobile, normalizePhone } from '@/lib/phone'
import { captureLead } from '@/app/(catalog)/lead-actions'
import { pushDataLayerEvent } from '@/lib/analytics'

// Long enough to see what the shop is before being asked anything.
const SHOW_DELAY_MS = 4000

// Pages with their own contact form (review) or nothing left to ask
// (confirmation, payment) never show the prompt.
function isExcludedPath(pathname: string | null) {
  return !!pathname && (pathname === '/review' || pathname.startsWith('/order/') || pathname.startsWith('/pay/'))
}

/**
 * Asks first-time visitors for their name and number so staff can reach
 * them even if they never submit a list. Optional: "Maybe later" hides it
 * for the rest of the browser session. Once saved it never shows again in
 * this browser, and the details prefill the review page.
 */
export function WelcomeContactDialog() {
  const pathname = usePathname()
  const { contact, isHydrated } = useContact()
  const [open, setOpen] = useState(false)

  const eligible = isHydrated && !contact && !isExcludedPath(pathname)

  useEffect(() => {
    if (!eligible || isContactPromptDismissed()) return
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [eligible])

  if (!open || isExcludedPath(pathname)) return null
  return <WelcomeContactForm onClose={() => setOpen(false)} />
}

function WelcomeContactForm({ onClose }: { onClose: () => void }) {
  const { saveContact } = useContact()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function dismiss() {
    if (saving) return
    if (!saved) dismissContactPrompt()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter your name.')
    if (!isValidPhMobile(phone)) return setError('Please enter a valid mobile number (09XX XXX XXXX).')
    setError(null)
    setSaving(true)
    const result = await captureLead({ name, phone, website })
    setSaving(false)
    if (result.error) return setError(result.error)

    saveContact({ name: name.trim(), phone: normalizePhone(phone), leadId: result.leadId, leadToken: result.leadToken })
    pushDataLayerEvent('contact_captured')
    setSaved(true)
    setTimeout(onClose, 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-contact-title"
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
      >
        {saved ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
            <p className="mt-3 text-base font-bold text-slate-900">Thanks, {name.trim().split(' ')[0]}!</p>
            <p className="mt-1 text-sm text-slate-500">We&apos;ll be in touch. Add items to your list anytime and send it when you&apos;re ready.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-5 pt-5 pb-3 flex items-start gap-3">
              <div className="w-10 h-10 flex-shrink-0 rounded-full bg-[#ffc107]/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 id="welcome-contact-title" className="text-base font-bold text-slate-900">Hi! Let us help you</h2>
                <p className="text-sm text-slate-500 mt-0.5">Leave your name and number and our staff can help you with prices, stock and delivery.</p>
              </div>
              <button type="button" onClick={dismiss} aria-label="Close" className="w-9 h-9 -mr-2 -mt-1 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 space-y-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  placeholder="Juan dela Cruz"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Mobile number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XX XXX XXXX"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </label>
              {/* Honeypot — off-screen for people, tempting for bots. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute -left-[9999px] w-px h-px opacity-0"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-5 pb-5 pt-2 space-y-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={dismiss} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1.5">
                Maybe later
              </button>
              <p className="text-[11px] text-center text-slate-400">We only use your number to help with your request.</p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
