import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShopSettings, getVisibleCategories } from '@/lib/supabase/queries/shop-settings'
import { ProductGrid } from '@/components/product-grid'
import { slugify } from '@/lib/slug'

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string }>
}

async function resolveCategory(slug: string) {
  const settings = await getShopSettings()
  const branchId = settings?.branch_id ?? ''
  const categories = await getVisibleCategories(branchId)
  return categories.find(c => slugify(c.name) === slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await resolveCategory(slug)

  if (!category) return { title: 'Category Not Found' }
  return {
    title: category.name,
    description: `Shop ${category.name} at SYD Construction Supplies — order online for delivery or pickup.`,
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const category = await resolveCategory(slug)

  if (!category) notFound()

  return <ProductGrid categoryId={category.id} />
}
