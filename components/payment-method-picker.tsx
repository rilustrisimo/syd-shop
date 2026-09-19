'use client'

import { useRef, useState } from 'react'
import { CheckCircle, Upload, X, ZoomIn, Download } from 'lucide-react'
import { submitPayment } from '@/app/pay/[orderId]/actions'
import type { PaymentMethod, ShopQrCode, ShopBankAccount } from '@/lib/types'

interface PaymentMethodPickerProps {
  orderId: string
  qrCodes: ShopQrCode[]
  bankAccounts: ShopBankAccount[]
}

const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors bg-white"

// Fetches the QR as a blob so the save works cross-origin (Supabase Storage
// is a different origin than the shop) — the `download` attribute alone is
// unreliable cross-origin. Falls back to opening in a new tab so the
// customer can still long-press to save it manually if the fetch is blocked.
async function handleDownloadQr(qr: ShopQrCode) {
  try {
    const res = await fetch(qr.image_url)
    const blob = await res.blob()
    const ext = blob.type.split('/')[1] || 'png'
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `${qr.label.toLowerCase().replace(/\s+/g, '-')}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(qr.image_url, '_blank')
  }
}

export function PaymentMethodPicker({ orderId, qrCodes, bankAccounts }: PaymentMethodPickerProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null)
  const [zoomedQr, setZoomedQr] = useState(false)
  const [referenceNo, setReferenceNo] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const proofInputRef = useRef<HTMLInputElement>(null)
  const selectedQr = paymentMethod === 'qr' ? qrCodes.find(qr => qr.id === selectedQrId) ?? null : null

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
        <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
        <p className="font-semibold text-green-900">Thanks! We&apos;ve got your payment info.</p>
        <p className="text-sm text-green-800">Our staff will verify it shortly and confirm your order.</p>
      </div>
    )
  }

  async function handleSubmit() {
    setError(null)
    if (!paymentMethod) {
      setError('Please select a payment method.')
      return
    }
    if (paymentMethod === 'qr' && !selectedQr) {
      setError('Please select which QR code you paid with.')
      return
    }
    if (!referenceNo.trim()) {
      setError('Please enter your payment reference number.')
      return
    }

    setSubmitting(true)
    let proofFormData: FormData | null = null
    if (proofFile) {
      proofFormData = new FormData()
      proofFormData.append('proof', proofFile)
    }

    const result = await submitPayment(
      { orderId, paymentMethod, qrLabel: selectedQr?.label ?? null, referenceNo },
      proofFormData
    )

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSubmitted(true)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {qrCodes.map(qr => {
          const isSelected = paymentMethod === 'qr' && selectedQrId === qr.id
          return (
            <button
              key={qr.id}
              type="button"
              onClick={() => { setPaymentMethod('qr'); setSelectedQrId(qr.id) }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'
              }`}
            >
              {qr.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr.logo_url} alt="" className="h-8 max-w-[76px] object-contain object-left" />
              ) : (
                <span className="text-xl">📷</span>
              )}
              <p className={`text-xs font-semibold mt-1 ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                {qr.label}
              </p>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => { setPaymentMethod('bank_transfer'); setSelectedQrId(null) }}
          className={`p-3 rounded-xl border-2 text-left transition-all ${
            paymentMethod === 'bank_transfer' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'
          }`}
        >
          <span className="text-xl">🏦</span>
          <p className={`text-xs font-semibold mt-1 ${paymentMethod === 'bank_transfer' ? 'text-blue-700' : 'text-slate-600'}`}>
            Bank Transfer
          </p>
        </button>
      </div>

      {paymentMethod === 'qr' && selectedQr && (
        <div className="flex flex-col items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => setZoomedQr(true)}
            className="relative w-64 h-64 max-w-full rounded-xl border border-slate-200 bg-white overflow-hidden cursor-zoom-in group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedQr.image_url} alt={selectedQr.label} className="w-full h-full object-contain" />
            <span className="absolute bottom-1.5 right-1.5 bg-slate-900/70 text-white rounded-full p-1.5 group-hover:bg-slate-900/90 transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </span>
          </button>
          <p className="text-xs text-slate-500">Scan to pay via {selectedQr.label} · Tap to zoom</p>
          <button
            type="button"
            onClick={() => handleDownloadQr(selectedQr)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Download className="w-3.5 h-3.5" />
            Download QR to upload in your banking app
          </button>
        </div>
      )}
      {paymentMethod === 'bank_transfer' && (
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

      {paymentMethod && (
        <div className="space-y-3 pt-1 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Reference / Confirmation Number <span className="text-red-400">*</span>
            </label>
            <input required value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
              placeholder="e.g. GCash ref 1234567890" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Upload Payment Screenshot (Optional)</label>
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
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !paymentMethod}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-md"
      >
        {submitting ? 'Submitting...' : 'Submit Payment Info'}
      </button>

      {zoomedQr && selectedQr && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setZoomedQr(false)}
        >
          <button
            type="button"
            onClick={() => setZoomedQr(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedQr.image_url}
              alt={selectedQr.label}
              className="w-[min(85vw,420px)] aspect-square object-contain rounded-xl bg-white"
            />
            <p className="text-sm text-white/80">Scan to pay via {selectedQr.label}</p>
            <button
              type="button"
              onClick={() => handleDownloadQr(selectedQr)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download QR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
