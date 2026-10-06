declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

// Every tracked moment in the app pushes through here instead of calling
// a vendor SDK (gtag/fbq) directly — Google Tag Manager reads this
// dataLayer and fans each event out to whatever's configured in its own
// dashboard (GA4, Meta Pixel, Google Ads conversions), so this file never
// needs to change when a new ad platform gets added later.
export function pushDataLayerEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...data })
}

export interface EcommerceItem {
  item_id: string
  item_name: string
  price: number
  quantity?: number
}

export interface EcommerceData {
  currency: 'PHP'
  value: number
  items: EcommerceItem[]
  transaction_id?: string
}

// GA4's standard ecommerce events (view_item, add_to_cart, begin_checkout,
// purchase, etc.) specifically expect the event's data nested under an
// "ecommerce" key, not flat on the event object — this is also what lets
// Meta's official GTM template (April 2026) auto-map these to Pixel
// events with no manual GTM configuration. Clearing the ecommerce object
// first is GA4's own documented requirement: without it, an items array
// from a previous push can bleed into the next event.
export function pushEcommerceEvent(event: string, ecommerce: EcommerceData) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ ecommerce: null })
  window.dataLayer.push({ event, ecommerce })
}
