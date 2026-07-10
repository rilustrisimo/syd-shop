export interface ShopSettings {
  id: string
  store_name: string
  store_phone: string | null
  store_address: string | null
  store_latitude: number
  store_longitude: number
  gcash_number: string | null
  gcash_name: string | null
  bank_name: string | null
  bank_account_no: string | null
  bank_account_name: string | null
  qr_code_url: string | null
  store_hours: string | null
  staff_notification_emails: string | null
  delivery_fee_flat: number
  delivery_fee_per_km: number
  cod_radius_km: number
  branch_id: string | null
}

// Public-safe version (no store coordinates)
export type PublicShopSettings = Omit<ShopSettings, 'store_latitude' | 'store_longitude'>

export interface ShopProduct {
  id: string
  code: string
  name: string
  description: string | null
  current_selling_price: number
  primary_image_url: string | null
  unit_label: string
  category_id: string
  category_name: string
  subcategory_id: string | null
  subcategory_name: string | null
  quantity_on_hand: number
  in_stock: boolean
}

export interface ShopProductDetail extends ShopProduct {
  images: Array<{ url: string; alt_text: string | null; is_primary: boolean; sort_order: number }>
}

export interface ShopCategory {
  id: string
  name: string
  subcategories: Array<{ id: string; name: string }>
}

export interface CartItem {
  product_id: string
  product_code: string
  product_name: string
  unit_label: string
  unit_price: number
  quantity: number
  image_url: string | null
}

export type FulfillmentType = 'delivery' | 'pickup'
export type PaymentMethod = 'cod' | 'gcash' | 'bank_transfer' | 'qr'

export interface DeliveryCalc {
  distance_km: number
  delivery_fee: number
  cod_available: boolean
}
