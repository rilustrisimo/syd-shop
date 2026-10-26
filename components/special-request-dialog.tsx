'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ClipboardList, Loader2, X } from 'lucide-react'
import { useCart } from '@/lib/cart'
import { SPECIAL_REQUEST_PREFIX } from '@/lib/types'
import { preparePhoto } from '@/lib/photo-resize'
import { uploadSpecialRequestPhoto } from '@/app/special-request/actions'

const MAX_PHOTOS = 3
const UNITS = ['pcs', 'bags', 'meters', 'feet', 'sheets', 'kilos', 'cu.m', 'rolls', 'sets']

interface SpecialRequestDialogProps {
  open: boolean
  onClose: () => void
  /** Prefills "What do you need?", e.g. the search that found nothing. */
  initialName?: string
  onAdded?: () => void
}

interface PhotoState {
  path: string
  thumb: string
}

/**
 * "Can't find it? Request it" — the customer describes an item that isn't
 * in the catalog, how many, and optional sample photos. It's added to the
 * cart as a special request line (no price) and submitted with the rest of
 * their quote request; staff reply with the quote.
 */
export function SpecialRequestDialog(props: SpecialRequestDialogProps) {
  // Mounted only while open, so every opening starts with a fresh form.
  return props.open ? <SpecialRequestForm {...props} /> : null
}

function SpecialRequestForm({ onClose, initialName = '', onAdded }: SpecialRequestDialogProps) {
  const { addItem } = useCart()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [details, setDetails] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [photos, setPhotos] = useState<PhotoState[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !uploading) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uploading, onClose])

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length)
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        const { upload, thumb } = await preparePhoto(file)
        const form = new FormData()
        form.append('photo', upload)
        const res = await uploadSpecialRequestPhoto(form)
        if (res.error || !res.path) throw new Error(res.error ?? 'Upload failed.')
        setPhotos((prev) => [...prev, { path: res.path!, thumb }])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo.')
    } finally {
      setUploading(false)
    }
  }

  function handleAdd() {
    const qty = Number(quantity)
    if (!name.trim()) return setError('Tell us what item you need.')
    if (!qty || qty <= 0) return setError('Enter how many you need.')
    addItem({
      product_id: `${SPECIAL_REQUEST_PREFIX}${crypto.randomUUID()}`,
      product_code: 'SPECIAL',
      product_name: name.trim().slice(0, 120),
      unit_label: unit.trim() || 'pcs',
      unit_price: 0,
      quantity: qty,
      image_url: null,
      special: {
        details: details.trim().slice(0, 500),
        photos: photos.map((p) => p.path),
        thumbs: photos.map((p) => p.thumb),
      },
    })
    onAdded?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !uploading && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="special-request-title"
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start gap-3">
          <ClipboardList className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h2 id="special-request-title" className="text-base font-bold text-slate-900">Request an item</h2>
            <p className="text-xs text-slate-500 mt-0.5">Not in our list? Tell us what you need. We&apos;ll check and include it in your quote.</p>
          </div>
          <button type="button" onClick={onClose} disabled={uploading} aria-label="Close" className="w-9 h-9 -mr-2 -mt-1 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">What do you need? *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. Marine plywood 1/2" 4x8'
              maxLength={120}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Details <span className="font-normal text-slate-400">(size, brand, color, thickness…)</span></span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anything that helps us find the right item"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">How many? *</span>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                placeholder="e.g. 20"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Unit</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                list="special-request-units"
                maxLength={20}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
              <datalist id="special-request-units">
                {UNITS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Sample photos <span className="font-normal text-slate-400">(optional, up to {MAX_PHOTOS})</span></span>
            <div className="flex gap-2 flex-wrap">
              {photos.map((p, i) => (
                <div key={p.path} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={`Sample ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((x) => x.path !== p.path))}
                    aria-label="Remove photo"
                    className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 flex flex-col items-center justify-center gap-1 text-[11px] hover:border-blue-400 hover:text-blue-600"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  {uploading ? 'Uploading' : 'Add photo'}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            <p className="text-[11px] text-slate-400">A photo of the item, its label, or a sample helps us quote the right one.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button type="button" onClick={onClose} disabled={uploading} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={handleAdd} disabled={uploading} className="flex-[2] rounded-lg bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            Add to my request
          </button>
        </div>
      </div>
    </div>
  )
}
