'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getShopSettings } from '@/lib/supabase/queries/shop-settings'
import { after } from 'next/server'
import { cookies, headers } from 'next/headers'
import { leadEventId, sendMetaLead, type MetaRequestContext } from '@/lib/meta-capi'
import { isSpecialRequest, type CartItem, type FulfillmentType } from '@/lib/types'
import { normalizePhone } from '@/lib/phone'
import { escapeHtml, notifyStaff, posOrderUrl } from '@/lib/notify-staff'

const MAX_SPECIAL_REQUESTS = 5
// Exactly what uploadSpecialRequestPhoto() produces — anything else is a
// tampered cart and must not be attached to an order.
const PHOTO_PATH = /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/

export interface CheckoutPayload {
  name: string
  phone: string
  fulfillment: FulfillmentType
  street: string
  barangay: string
  municipality: string
  province: string
  notes: string
  items: CartItem[]
  // The 'lead' row the welcome form created, if this browser has one.
  leadId?: string
  leadToken?: string
}

export interface CheckoutResult {
  orderNumber?: string
  error?: string
}

// What Meta needs to match the lead to the person who saw the ad. Read
// during the request (not inside after()) so it's always available.
async function metaRequestContext(): Promise<MetaRequestContext> {
  const h = await headers()
  const c = await cookies()
  return {
    clientIp: h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    userAgent: h.get('user-agent'),
    fbp: c.get('_fbp')?.value ?? null,
    fbc: c.get('_fbc')?.value ?? null,
    sourceUrl: h.get('referer'),
  }
}

export async function submitOrder(payload: CheckoutPayload): Promise<CheckoutResult> {
  const { name, phone, fulfillment, street, barangay, municipality, province, notes, items, leadId, leadToken } = payload

  if (!name.trim() || !phone.trim()) return { error: 'Name and phone are required.' }
  if (items.length === 0) return { error: 'Your list is empty.' }
  if (fulfillment === 'delivery' && (!barangay.trim() || !municipality.trim())) {
    return { error: 'Delivery address is required.' }
  }

  if (items.some(i => !i.quantity || i.quantity <= 0)) {
    return { error: 'Invalid item quantity in your list. Please review your list and try again.' }
  }

  // Special requests (items not in the catalog) are validated on their own —
  // they have no product to check, and their photo paths must be ones our
  // upload action could have produced.
  const specialItems = items.filter(isSpecialRequest)
  const catalogItems = items.filter(i => !isSpecialRequest(i))
  if (specialItems.length > MAX_SPECIAL_REQUESTS) {
    return { error: `Please keep special requests to ${MAX_SPECIAL_REQUESTS} per request.` }
  }
  const specialLines: { name: string; details: string; unit: string; quantity: number; photos: string[] }[] = []
  for (const s of specialItems) {
    const itemName = (s.product_name ?? '').trim().slice(0, 120)
    const photos = Array.isArray(s.special?.photos) ? s.special!.photos : []
    if (!itemName) return { error: 'A special request is missing its description. Please review your list.' }
    if (photos.length > 3 || photos.some(p => typeof p !== 'string' || !PHOTO_PATH.test(p))) {
      return { error: 'A special request has an invalid photo. Please remove it and add the photo again.' }
    }
    specialLines.push({
      name: itemName,
      details: (s.special?.details ?? '').trim().slice(0, 500),
      unit: (s.unit_label ?? '').trim().slice(0, 20) || 'pcs',
      quantity: Number(s.quantity),
      photos,
    })
  }

  const settings = await getShopSettings()
  if (!settings) return { error: 'Shop is not configured. Please try again later.' }

  const normalizedPhone = normalizePhone(phone)
  const supabase = createServerClient()

  // Re-validate items against the database — never trust client-submitted prices.
  // A tampered cart (edited localStorage) or a price/availability change since
  // the item was added must not be able to change what gets charged.
  // An order with only special requests has no catalog products to check.
  const { data: dbProducts, error: productsErr } = catalogItems.length
    ? await supabase
        .from('products')
        .select(`
          id, code, name, current_selling_price, is_active,
          selling_uom:units_of_measure!products_selling_uom_id_fkey(code, name),
          overrides:shop_product_overrides(hidden_online)
        `)
        .in('id', catalogItems.map(i => i.product_id))
    : { data: [], error: null }

  if (productsErr) {
    console.error('Product validation error:', productsErr.message)
    return { error: "We couldn't check your list. Please try again." }
  }

  const productMap = new Map((dbProducts ?? []).map((p: any) => [p.id, p]))
  const unavailable: string[] = []
  const validatedItems = catalogItems.map(item => {
    const p: any = productMap.get(item.product_id)
    if (!p || !p.is_active || p.overrides?.[0]?.hidden_online) {
      unavailable.push(item.product_name)
      return null
    }
    return {
      product_id: item.product_id,
      product_code: p.code as string,
      product_name: p.name as string,
      unit_label: p.selling_uom?.code ?? p.selling_uom?.name ?? item.unit_label,
      unit_price: Number(p.current_selling_price),
      quantity: item.quantity,
    }
  })

  if (unavailable.length > 0) {
    return { error: `These items are no longer available: ${unavailable.join(', ')}. Please remove them from your list and try again.` }
  }

  const orderItems = validatedItems as { product_id: string; product_code: string; product_name: string; unit_label: string; unit_price: number; quantity: number }[]

  // Delivery fee, discount, and payment method are all deliberately left
  // unset here — staff finalize the delivery fee/discount in syd-pos after
  // reviewing the order, then send a payment link (Online Orders > Copy
  // Payment Link) where the customer picks how they'll pay.
  const subtotal = orderItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const total_amount = subtotal

  // Customer match / create — matched by phone number, tolerant of whatever
  // format the number was originally entered in (spaces, dashes, with or
  // without +63/63 country code, with or without the leading 0). Existing
  // customers in the main POS directory were typed in by hand over time and
  // aren't all in the same format, so an exact string match on the raw
  // column would create duplicate customers instead of linking to the real
  // one. Comparing normalizePhone() output on both sides fixes that without
  // needing to rewrite any stored phone numbers.
  let customerId: string | null = null
  try {
    const { data: candidates } = await supabase
      .from('customers')
      .select('id, phone')

    const existing = (candidates ?? []).find(
      (c) => c.phone && normalizePhone(c.phone) === normalizedPhone
    )

    if (existing) {
      customerId = existing.id
    } else {
      const fullAddress = [street, barangay, municipality, province].filter(Boolean).join(', ')
      const { data: newCustomer, error: insertErr } = await supabase
        .from('customers')
        .insert({
          name: name.trim(),
          phone: normalizedPhone,
          address: fullAddress || null,
          customer_type: 'walk_in',
          credit_limit: 0,
          outstanding_balance: 0,
          is_active: true,
        })
        .select('id')
        .single()

      if (insertErr) {
        console.error('Customer create error:', insertErr.message)
      } else {
        customerId = newCustomer?.id ?? null
      }
    }
  } catch (err) {
    console.error('Customer lookup error:', err)
  }

  const orderFields = {
    status: 'pending',
    fulfillment,
    customer_name: name.trim(),
    customer_phone: normalizedPhone,
    address: fulfillment === 'delivery' ? [street, barangay, municipality, province].filter(Boolean).join(', ') : null,
    barangay: barangay || null,
    municipality: municipality || null,
    province: province || null,
    latitude: null,
    longitude: null,
    distance_km: null,
    payment_method: null,
    payment_qr_label: null,
    payment_status: 'unpaid',
    payment_reference_no: null,
    subtotal,
    delivery_fee: 0,
    total_amount,
    notes: notes || null,
    customer_id: customerId,
  }

  // Visitors who left their number on the welcome form already have a
  // 'lead' row: fill that one in (same row staff may already be calling
  // about) instead of creating a second entry. The token is single-use.
  // If it no longer matches (already submitted, cancelled or deleted by
  // staff) this is simply a new request.
  let order: { id: string; order_number: string } | null = null
  let fromLead = false
  if (leadId && leadToken) {
    const now = new Date().toISOString()
    const { data: converted } = await supabase
      .from('online_orders')
      .update({ ...orderFields, lead_token: null, lead_converted_at: now })
      .eq('id', leadId)
      .eq('lead_token', leadToken)
      .eq('status', 'lead')
      .is('deleted_at', null)
      .select('id, order_number')
      .maybeSingle()
    if (converted) {
      order = converted
      fromLead = true
    }
  }

  if (!order) {
    const { data: inserted, error: orderErr } = await supabase
      .from('online_orders')
      .insert(orderFields)
      .select('id, order_number')
      .single()
    if (orderErr || !inserted) {
      console.error('Order insert error:', orderErr?.message)
      return { error: "We couldn't send your request. Please try again." }
    }
    order = inserted
  }

  // Insert order lines
  const lines = orderItems.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    product_code: item.product_code,
    product_name: item.product_name,
    unit_label: item.unit_label,
    unit_price: item.unit_price,
    quantity: item.quantity,
    line_total: item.unit_price * item.quantity,
  }))

  const requestLines = specialLines.map(s => ({
    order_id: order.id,
    product_id: null,
    product_code: 'SPECIAL',
    product_name: s.name,
    unit_label: s.unit,
    unit_price: 0,
    quantity: s.quantity,
    line_total: 0,
    is_special_request: true,
    request_description: s.details || null,
    request_photos: s.photos.length ? s.photos : null,
  }))

  const allLines = [...lines, ...requestLines]
  const { error: linesErr } = allLines.length
    ? await supabase.from('online_order_lines').insert(allLines)
    : { error: null }
  if (linesErr) console.error('Order lines insert error:', linesErr.message)

  // Server-side Lead for Meta, deduplicated with the browser Pixel's
  // generate_lead via the shared event ID. Runs after the response so
  // checkout never waits on Meta.
  const metaContext = await metaRequestContext()
  const orderNumber = order.order_number
  after(() => sendMetaLead({
    eventId: leadEventId(orderNumber),
    orderNumber,
    value: subtotal,
    itemCount: allLines.length,
    phone: normalizedPhone,
    name: name.trim(),
    municipality: fulfillment === 'delivery' ? municipality : undefined,
    province: fulfillment === 'delivery' ? province : undefined,
  }, metaContext))

  // Staff email
  const itemsList = orderItems.map(i =>
    `• ${escapeHtml(i.product_name)} × ${i.quantity} ${escapeHtml(i.unit_label)} — ₱${(i.unit_price * i.quantity).toLocaleString('en-PH')}`
  ).join('<br>')
  await notifyStaff(
    `New Online Order — ${order.order_number}${fromLead ? ' (from lead)' : ''}`,
    `
      <h2>New Online Order Received</h2>
      ${fromLead ? '<p><em>This visitor left their number earlier; their lead is now this order.</em></p>' : ''}
      <p><strong>Order:</strong> ${order.order_number}</p>
      <p><strong>Customer:</strong> ${escapeHtml(name.trim())} · ${normalizedPhone}</p>
      <p><strong>Fulfillment:</strong> ${fulfillment === 'delivery' ? 'Delivery (fee not yet set)' : 'Pickup'}</p>
      <p><strong>Payment:</strong> not yet selected — send a payment link once the order is finalized</p>
      <hr/>
      ${itemsList ? `<p><strong>Items:</strong><br>${itemsList}</p>` : ''}
      ${specialLines.length ? `<p><strong>Special requests (not in catalog — needs a quote):</strong><br>${specialLines.map(s =>
        `• ${escapeHtml(s.name)} × ${s.quantity} ${escapeHtml(s.unit)}${s.details ? ` — ${escapeHtml(s.details)}` : ''}${s.photos.length ? ` (${s.photos.length} photo${s.photos.length > 1 ? 's' : ''})` : ''}`
      ).join('<br>')}</p>` : ''}
      <hr/>
      <p><strong>Subtotal:</strong> ₱${subtotal.toLocaleString('en-PH')}</p>
      ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
      <hr/>
      <p><a href="${posOrderUrl(order.id)}">View Order in POS →</a></p>
    `,
  )

  return { orderNumber: order.order_number }
}
