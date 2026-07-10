'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CartItem } from '@/lib/types'

const CART_KEY = 'syd_shop_cart'

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
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setItems(readCart())
    setIsHydrated(true)

    // Sync across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setItems(readCart())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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
    localStorage.removeItem(CART_KEY)
  }, [])

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return { items, itemCount, subtotal, addItem, updateQuantity, removeItem, clearCart, isHydrated }
}
