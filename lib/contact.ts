'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FulfillmentType } from '@/lib/types'

// The visitor's own contact details, kept in their browser so the welcome
// form only ever asks once and the review page is prefilled on every
// request. leadId/leadToken point at the 'lead' row the welcome form
// created; submitting a list turns that row into the real request, after
// which they're cleared (the details stay for next time).
export interface SavedContact {
  name: string
  phone: string
  leadId?: string
  leadToken?: string
  fulfillment?: FulfillmentType
  street?: string
  barangay?: string
  municipality?: string
  province?: string
}

const CONTACT_KEY = 'syd_shop_contact'
// Same-tab sync between useContact() instances (see CART_UPDATED_EVENT
// in lib/cart.ts for why).
const CONTACT_UPDATED_EVENT = 'syd-contact-updated'

function readContact(): SavedContact | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? 'null')
    return parsed && typeof parsed.phone === 'string' && parsed.phone ? parsed : null
  } catch {
    return null
  }
}

function writeContact(contact: SavedContact | null) {
  try {
    if (contact) localStorage.setItem(CONTACT_KEY, JSON.stringify(contact))
    else localStorage.removeItem(CONTACT_KEY)
  } catch {
    // Private mode / blocked storage: the form just asks again next visit.
  }
  queueMicrotask(() => window.dispatchEvent(new Event(CONTACT_UPDATED_EVENT)))
}

export function useContact() {
  const [contact, setContact] = useState<SavedContact | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setContact(readContact())
    setIsHydrated(true)

    const sync = () => setContact(readContact())
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONTACT_KEY) sync()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CONTACT_UPDATED_EVENT, sync)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CONTACT_UPDATED_EVENT, sync)
    }
  }, [])

  // Merges into what's saved, so the review page can update the address
  // without dropping the lead reference (and vice versa).
  const saveContact = useCallback((patch: Partial<SavedContact>) => {
    const next = { ...(readContact() ?? { name: '', phone: '' }), ...patch }
    setContact(next)
    writeContact(next)
  }, [])

  return { contact, saveContact, isHydrated }
}

// "Maybe later" on the welcome form hides it for the rest of this browser
// session only; it asks again on the next visit until they save.
const DISMISSED_KEY = 'syd_contact_dismissed'

export function isContactPromptDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissContactPrompt() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // ignore
  }
}
