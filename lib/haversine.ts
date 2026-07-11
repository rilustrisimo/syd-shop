import type { DeliveryCalc, ShopSettings } from '@/lib/types'

export const COD_MAX_SUBTOTAL = 5_000  // COD blocked for orders at or above this amount

export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

type FeeSettings = Pick<ShopSettings, 'cod_radius_km' | 'delivery_fee_flat' | 'delivery_fee_per_km'>

/** Convert a known distance into a DeliveryCalc result. Used by both sync (Haversine) and async (OSRM) paths. */
export function calcFeeFromDistance(
  distance_km: number,
  settings: FeeSettings,
  road_based = false
): DeliveryCalc {
  const cod_available = distance_km <= settings.cod_radius_km
  const delivery_fee = cod_available
    ? settings.delivery_fee_flat
    : Math.round(settings.delivery_fee_per_km * distance_km)
  return { distance_km, delivery_fee, cod_available, road_based }
}

/** Synchronous Haversine-based calculation — used as a fallback when OSRM is unavailable. */
export function calcDelivery(
  customerLat: number,
  customerLng: number,
  settings: Pick<ShopSettings, 'store_latitude' | 'store_longitude' | 'cod_radius_km' | 'delivery_fee_flat' | 'delivery_fee_per_km'>
): DeliveryCalc {
  const raw_km = haversineKm(
    settings.store_latitude, settings.store_longitude,
    customerLat, customerLng
  )
  return calcFeeFromDistance(Math.round(raw_km * 10) / 10, settings, false)
}
