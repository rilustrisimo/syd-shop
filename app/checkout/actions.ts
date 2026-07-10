'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getShopSettings } from '@/lib/supabase/queries/shop-settings'
import { calcDelivery } from '@/lib/haversine'
import { Resend } from 'resend'
import type { CartItem, FulfillmentType, PaymentMethod } from '@/lib/types'

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
  pinLat: number | null
  pinLng: number | null
  paymentMethod: PaymentMethod
  referenceNo: string
  notes: string
  items: CartItem[]
}

export interface CheckoutResult {
  orderNumber?: string
  error?: string
}

export async function submitOrder(
  payload: CheckoutPayload,
  proofFile: FormData | null
): Promise<CheckoutResult> {
  const {
    name, phone, fulfillment, street, barangay, municipality, province,
    pinLat, pinLng, paymentMethod, referenceNo, notes, items,
  } = payload

  if (!name.trim() || !phone.trim()) return { error: 'Name and phone are required.' }
  if (items.length === 0) return { error: 'Your cart is empty.' }
  if (fulfillment === 'delivery' && (!barangay.trim() || !municipality.trim())) {
    return { error: 'Delivery address is required.' }
  }
  if (fulfillment === 'delivery' && (pinLat == null || pinLng == null)) {
    return { error: 'Please pin your delivery location on the map.' }
  }

  const settings = await getShopSettings()
  if (!settings) return { error: 'Shop is not configured. Please try again later.' }

  const normalizedPhone = normalizePhone(phone)

  // Authoritative delivery fee
  let distance_km = 0
  let delivery_fee = 0
  let cod_available = true

  if (fulfillment === 'delivery' && pinLat != null && pinLng != null) {
    const calc = calcDelivery(pinLat, pinLng, settings)
    distance_km = calc.distance_km
    delivery_fee = calc.delivery_fee
    cod_available = calc.cod_available
  }

  if (fulfillment === 'delivery' && paymentMethod === 'cod' && !cod_available) {
    return { error: 'COD is not available for your distance. Please select another payment method.' }
  }

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const total_amount = subtotal + delivery_fee

  const supabase = createServerClient()

  // Customer match / create
  let customerId: string | null = null
  try {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1)
      .single()

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
      latitude: pinLat,
      longitude: pinLng,
      distance_km: distance_km || null,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'cod' ? 'unpaid' : 'submitted',
      payment_reference_no: referenceNo || null,
      subtotal,
      delivery_fee,
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
  const lines = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    product_code: item.product_code,
    product_name: item.product_name,
    unit_label: item.unit_label,
    unit_price: item.unit_price,
    quantity: item.quantity,
    line_total: item.unit_price * item.quantity,
  }))

  const { error: linesErr } = await supabase.from('online_order_lines').insert(lines)
  if (linesErr) console.error('Order lines insert error:', linesErr.message)

  // Proof upload (if provided)
  if (proofFile) {
    const file = proofFile.get('proof') as File | null
    if (file && file.size > 0) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${order.id}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('payment-proofs').getPublicUrl(path)
        await supabase
          .from('online_orders')
          .update({ payment_proof_url: publicUrl })
          .eq('id', order.id)
      } else {
        console.error('Proof upload error:', uploadErr.message)
      }
    }
  }

  // Resend email notification
  if (settings.staff_notification_emails && process.env.RESEND_API_KEY) {
    const emails = settings.staff_notification_emails.split(',').map(e => e.trim()).filter(Boolean)
    if (emails.length > 0) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const itemsList = items.map(i =>
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
            <p><strong>Fulfillment:</strong> ${fulfillment === 'delivery' ? `Delivery (${distance_km} km · ₱${delivery_fee} delivery fee)` : 'Pickup'}</p>
            <p><strong>Payment:</strong> ${paymentMethod.replace('_', ' ').toUpperCase()}${referenceNo ? ` — Ref: ${referenceNo}` : ''}</p>
            <hr/>
            <p><strong>Items:</strong><br>${itemsList}</p>
            <hr/>
            <p><strong>Subtotal:</strong> ₱${subtotal.toLocaleString('en-PH')}</p>
            <p><strong>Delivery fee:</strong> ₱${delivery_fee.toLocaleString('en-PH')}</p>
            <p><strong>Total:</strong> ₱${total_amount.toLocaleString('en-PH')}</p>
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
