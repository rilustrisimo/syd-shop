import type { Metadata } from 'next'
import { ProductGrid } from '@/components/product-grid'

export const metadata: Metadata = { title: 'Browse Products' }
export const revalidate = 60

export default function CatalogPage() {
  return <ProductGrid />
}
