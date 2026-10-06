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
