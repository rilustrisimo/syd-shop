'use client'

import { createContext, useContext } from 'react'
import type { ShopCategory, CartItem } from '@/lib/types'

export interface CatalogContextValue {
  branchId: string
  categories: ShopCategory[]
  search: string
  setSearch: (search: string) => void
  cart: {
    items: CartItem[]
    itemCount: number
    subtotal: number
    addItem: (item: CartItem) => void
    updateQuantity: (productId: string, quantity: number) => void
  }
}

export const CatalogContext = createContext<CatalogContextValue | null>(null)

export function useCatalogContext() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalogContext must be used within CatalogShell')
  return ctx
}
