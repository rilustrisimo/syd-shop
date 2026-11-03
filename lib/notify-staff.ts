import { Resend } from 'resend'
import { getShopSettings } from '@/lib/supabase/queries/shop-settings'

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function posOrderUrl(orderId: string): string {
  return `${process.env.NEXT_PUBLIC_POS_URL ?? 'https://app.sydconstruct.com'}/orders/online/${orderId}`
}

// Emails everyone in shop_settings.staff_notification_emails. Never throws:
// a failed email must not fail the customer's submission. Callers escape
// any customer-typed text they put in `html`.
export async function notifyStaff(subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  const settings = await getShopSettings()
  const emails = (settings?.staff_notification_emails ?? '').split(',').map(e => e.trim()).filter(Boolean)
  if (emails.length === 0) return
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'orders@sydconstruct.com',
      to: emails,
      subject,
      html,
    })
  } catch (err) {
    console.error('Email send error:', err)
  }
}
