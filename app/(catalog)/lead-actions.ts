'use server'

import { randomUUID } from 'crypto'
import { after } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhone, isValidPhMobile } from '@/lib/phone'
import { escapeHtml, notifyStaff, posOrderUrl } from '@/lib/notify-staff'

export interface CaptureLeadPayload {
  name: string
  phone: string
  // Honeypot: hidden from people, filled in by bots.
  website?: string
}

export interface CaptureLeadResult {
  leadId?: string
  leadToken?: string
  error?: string
}

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

// The welcome form: a visitor leaves their name and number before adding
// anything to their list. It becomes a 'lead' row in Online Orders right
// away so staff can call them; submitting a list later fills in that same
// row (see submitOrder in app/review/actions.ts).
export async function captureLead(payload: CaptureLeadPayload): Promise<CaptureLeadResult> {
  const name = (payload.name ?? '').trim().slice(0, 120)
  const phone = normalizePhone(payload.phone ?? '')

  if (!name) return { error: 'Please enter your name.' }
  if (!isValidPhMobile(phone)) return { error: 'Please enter a valid mobile number (09XX XXX XXXX).' }
  // Pretend it worked so the bot moves on; nothing is saved.
  if (payload.website) return { leadId: randomUUID(), leadToken: randomUUID() }

  const supabase = createServerClient()

  // Same number again within a day (cleared storage, another device):
  // reuse the open lead instead of filling the list with duplicates.
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
  const { data: existing } = await supabase
    .from('online_orders')
    .select('id, lead_token')
    .eq('status', 'lead')
    .eq('customer_phone', phone)
    .is('deleted_at', null)
    .gte('created_at', since)
    .not('lead_token', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabase.from('online_orders').update({ customer_name: name }).eq('id', existing.id)
    return { leadId: existing.id, leadToken: existing.lead_token }
  }

  const leadToken = randomUUID()
  const { data: lead, error } = await supabase
    .from('online_orders')
    .insert({
      status: 'lead',
      // Not known yet; the visitor picks it when they submit their list.
      fulfillment: 'pickup',
      customer_name: name,
      customer_phone: phone,
      payment_method: null,
      payment_status: 'unpaid',
      subtotal: 0,
      delivery_fee: 0,
      total_amount: 0,
      lead_token: leadToken,
      lead_captured_at: new Date().toISOString(),
    })
    .select('id, order_number')
    .single()

  if (error || !lead) {
    console.error('Lead insert error:', error?.message)
    return { error: "We couldn't save your details. Please try again." }
  }

  // After the response so the form closes instantly.
  after(() => notifyStaff(
    `New Lead — ${name} ${phone}`,
    `
      <h2>New Lead from the Online Shop</h2>
      <p>A visitor left their contact details before adding anything to their list. Give them a call.</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Reference:</strong> ${lead.order_number}</p>
      <hr/>
      <p><a href="${posOrderUrl(lead.id)}">View Lead in POS →</a></p>
    `,
  ))

  return { leadId: lead.id, leadToken }
}
