'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getShopSettings } from '@/lib/supabase/queries/shop-settings'
import { Resend } from 'resend'
import { isSpecialRequest, type CartItem, type FulfillmentType } from '@/lib/types'

const MAX_SPECIAL_REQUESTS = 5
// Exactly what uploadSpecialRequestPhoto() produces — anything else is a
// tampered cart and must not be attached to an order.
const PHOTO_PATH = /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('63') && digits.length === 12) return '0' + digits.slice(2)
  if (digits.length === 10 && digits.startsWith('9')) return '0' + digits
  return digits
}

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
}

export interface CheckoutResult {
  orderNumber?: string
  error?: string
}

export async function submitOrder(payload: CheckoutPayload): Promise<CheckoutResult> {
  const { name, phone, fulfillment, street, barangay, municipality, province, notes, items } = payload

  if (!name.trim() || !phone.trim()) return { error: 'Name and phone are required.' }
  if (items.length === 0) return { error: 'Your cart is empty.' }
  if (fulfillment === 'delivery' && (!barangay.trim() || !municipality.trim())) {
    return { error: 'Delivery address is required.' }
  }

  if (items.some(i => !i.quantity || i.quantity <= 0)) {
    return { error: 'Invalid item quantity in your cart. Please review your cart and try again.' }
  }

  // Special requests (items not in the catalog) are validated on their own —
  // they have no product to check, and their photo paths must be ones our
  // upload action could have produced.
  const specialItems = items.filter(isSpecialRequest)
  const catalogItems = items.filter(i => !isSpecialRequest(i))
  if (specialItems.length > MAX_SPECIAL_REQUESTS) {
    return { error: `Please keep special requests to ${MAX_SPECIAL_REQUESTS} per order.` }
  }
  const specialLines: { name: string; details: string; unit: string; quantity: number; photos: string[] }[] = []
  for (const s of specialItems) {
    const itemName = (s.product_name ?? '').trim().slice(0, 120)
    const photos = Array.isArray(s.special?.photos) ? s.special!.photos : []
    if (!itemName) return { error: 'A special request is missing its description. Please review your cart.' }
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
    return { error: 'Failed to validate your order. Please try again.' }
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
    return { error: `These items are no longer available: ${unavailable.join(', ')}. Please remove them from your cart and try again.` }
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

  // Insert order
  const { data: order, error: orderErr } = await supabase
    .from('online_orders')
    .insert({
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
    })
    .select('id, order_number')
    .single()

  if (orderErr || !order) {
    console.error('Order insert error:', orderErr?.message)
    return { error: 'Failed to place your order. Please try again.' }
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

  // Resend email notification
  if (settings.staff_notification_emails && process.env.RESEND_API_KEY) {
    const emails = settings.staff_notification_emails.split(',').map(e => e.trim()).filter(Boolean)
    if (emails.length > 0) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const itemsList = orderItems.map(i =>
          `• ${i.product_name} × ${i.quantity} ${i.unit_label} — ₱${(i.unit_price * i.quantity).toLocaleString('en-PH')}`
        ).join('<br>')

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'orders@sydconstruct.com',
          to: emails,
          subject: `New Online Order — ${order.order_number}`,
          html: `
            <h2>New Online Order Received</h2>
            <p><strong>Order:</strong> ${order.order_number}</p>
            <p><strong>Customer:</strong> ${name.trim()} · ${normalizedPhone}</p>
            <p><strong>Fulfillment:</strong> ${fulfillment === 'delivery' ? 'Delivery (fee not yet set)' : 'Pickup'}</p>
            <p><strong>Payment:</strong> not yet selected — send a payment link once the order is finalized</p>
            <hr/>
            ${itemsList ? `<p><strong>Items:</strong><br>${itemsList}</p>` : ''}
            ${specialLines.length ? `<p><strong>Special requests (not in catalog — needs a quote):</strong><br>${specialLines.map(s =>
              `• ${escapeHtml(s.name)} × ${s.quantity} ${escapeHtml(s.unit)}${s.details ? ` — ${escapeHtml(s.details)}` : ''}${s.photos.length ? ` (${s.photos.length} photo${s.photos.length > 1 ? 's' : ''})` : ''}`
            ).join('<br>')}</p>` : ''}
            <hr/>
            <p><strong>Subtotal:</strong> ₱${subtotal.toLocaleString('en-PH')}</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <hr/>
            <p><a href="${process.env.NEXT_PUBLIC_POS_URL ?? 'https://app.sydconstruct.com'}/orders/online/${order.id}">View Order in POS →</a></p>
          `,
        })
      } catch (emailErr) {
        console.error('Email send error:', emailErr)
      }
    }
  }

  return { orderNumber: order.order_number }
}
