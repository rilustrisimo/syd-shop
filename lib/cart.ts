'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CartItem } from '@/lib/types'

const CART_KEY = 'syd_shop_cart'
// Every component that calls useCart() gets its own independent local
// state (there's no shared store/context) - it only reads localStorage
// once on mount. The native `storage` event fires only in OTHER tabs, so
// without this, one instance writing (e.g. a product card's "Add to
// Cart") never notifies sibling instances elsewhere on the same page
// (e.g. the floating call button, header cart badge) - they'd go stale
// until they happened to re-mount. This custom event fixes same-tab sync.
const CART_UPDATED_EVENT = 'syd-cart-updated'

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(CART_UPDATED_EVENT))
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setItems(readCart())
    setIsHydrated(true)

    const syncFromStorage = () => setItems(readCart())

    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) syncFromStorage()
    }
    window.addEventListener('storage', onStorage)
    // Same-tab sync between independent useCart() instances
    window.addEventListener(CART_UPDATED_EVENT, syncFromStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CART_UPDATED_EVENT, syncFromStorage)
    }
  }, [])

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === item.product_id)
      const next = existing
        ? prev.map(i =>
            i.product_id === item.product_id
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          )
        : [...prev, item]
      writeCart(next)
      return next
    })
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems(prev => {
      const next = quantity <= 0
        ? prev.filter(i => i.product_id !== productId)
        : prev.map(i => i.product_id === productId ? { ...i, quantity } : i)
      writeCart(next)
      return next
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.product_id !== productId)
      writeCart(next)
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    writeCart([])
  }, [])

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return { items, itemCount, subtotal, addItem, updateQuantity, removeItem, clearCart, isHydrated }
}
