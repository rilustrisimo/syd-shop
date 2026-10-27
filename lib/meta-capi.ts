// Meta Conversions API — sends key events (a quote request = Lead) to Meta
// from the server, so they still count when the browser Pixel is blocked
// (ad blockers, iOS/Safari cookie limits, in-app browsers). The browser Pixel
// fires the same event with the same event_id, and Meta keeps only one.
//
// Customer details are normalized and SHA-256 hashed before leaving the
// server, as Meta requires. Import it only from server code: the access token is a secret.

const GRAPH_VERSION = 'v23.0'

/** Event ID shared by the browser Pixel (via dataLayer) and the server event. */
export function leadEventId(orderNumber: string): string {
  return `lead-${orderNumber}`
}

export interface MetaRequestContext {
  clientIp: string | null
  userAgent: string | null
  fbp: string | null
  fbc: string | null
  sourceUrl: string | null
}

export interface MetaLeadInput {
  eventId: string
  orderNumber: string
  value: number
  itemCount: number
  /** Philippine mobile in any common format (09…, 639…, +639…). */
  phone: string
  name: string
  municipality?: string
  province?: string
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Meta wants country code + number, digits only: 09171234567 → 639171234567. */
function phoneE164Digits(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('63') && d.length === 12) return d
  if (d.startsWith('09') && d.length === 11) return `63${d.slice(1)}`
  if (d.startsWith('9') && d.length === 10) return `63${d}`
  return null
}

/** Lowercase, letters only (Meta's rule for city/state/name fields). */
const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')

async function hashed(value: string | null | undefined): Promise<string[] | undefined> {
  return value ? [await sha256(value)] : undefined
}

export async function sendMetaLead(input: MetaLeadInput, ctx: MetaRequestContext): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!pixelId || !token) return

  const phone = phoneE164Digits(input.phone)
  const [first, ...rest] = input.name.trim().split(/\s+/)
  const last = rest.at(-1)

  const userData = {
    ph: await hashed(phone),
    external_id: await hashed(phone),
    fn: await hashed(first ? normalizeText(first) : null),
    ln: await hashed(last ? normalizeText(last) : null),
    ct: await hashed(input.municipality ? normalizeText(input.municipality) : null),
    st: await hashed(input.province ? normalizeText(input.province) : null),
    country: await hashed('ph'),
    client_ip_address: ctx.clientIp ?? undefined,
    client_user_agent: ctx.userAgent ?? undefined,
    fbp: ctx.fbp ?? undefined,
    fbc: ctx.fbc ?? undefined,
  }

  const body = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      action_source: 'website',
      event_source_url: ctx.sourceUrl ?? 'https://sydconstruct.com/checkout',
      user_data: userData,
      custom_data: {
        currency: 'PHP',
        value: input.value,
        order_id: input.orderNumber,
        num_items: input.itemCount,
        content_type: 'product',
      },
    }],
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('[meta-capi] Lead rejected', res.status, await res.text())
  } catch (err) {
    // Tracking must never break checkout.
    console.error('[meta-capi] Lead failed', err)
  }
}
