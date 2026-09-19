'use server'

import { createServerClient } from '@/lib/supabase/server'
import type { PaymentMethod } from '@/lib/types'

export interface SubmitPaymentPayload {
  orderId: string
  paymentMethod: PaymentMethod
  qrLabel: string | null
  referenceNo: string
}

export interface SubmitPaymentResult {
  ok?: true
  error?: string
}

// Called from the public /pay/[orderId] page once staff have finalized an
// order's delivery fee/discount and shared the link — this is where the
// customer actually picks how they'll pay and submits proof, moved here
// from checkout to keep checkout itself friction-free.
export async function submitPayment(
  payload: SubmitPaymentPayload,
  proofFile: FormData | null
): Promise<SubmitPaymentResult> {
  const { orderId, paymentMethod, qrLabel, referenceNo } = payload

  if (!referenceNo.trim()) {
    return { error: 'Please enter your payment reference number so staff can verify your payment.' }
  }

  const supabase = createServerClient()

  const { data: order } = await supabase
    .from('online_orders')
    .select('id')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Order not found.' }

  const { error: updateErr } = await supabase
    .from('online_orders')
    .update({
      payment_method: paymentMethod,
      payment_qr_label: paymentMethod === 'qr' ? qrLabel : null,
      payment_reference_no: referenceNo.trim(),
      payment_status: 'submitted',
    })
    .eq('id', orderId)

  if (updateErr) {
    console.error('Payment update error:', updateErr.message)
    return { error: 'Failed to submit your payment info. Please try again.' }
  }

  if (proofFile) {
    const file = proofFile.get('proof') as File | null
    if (file && file.size > 0) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${orderId}.${ext}`
      // upsert: true — a customer re-submitting (e.g. fixed a typo'd
      // reference) overwrites their previous screenshot rather than
      // erroring or leaving a stale duplicate.
      const { error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (!uploadErr) {
        // payment-proofs is a private bucket — store the object path, not a
        // public URL. The POS resolves it to a short-lived signed URL when
        // staff view it.
        await supabase.from('online_orders').update({ payment_proof_url: path }).eq('id', orderId)
      } else {
        console.error('Proof upload error:', uploadErr.message)
      }
    }
  }

  return { ok: true }
}
