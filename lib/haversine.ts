import type { DeliveryCalc, ShopSettings } from '@/lib/types'

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

export function calcDelivery(
  customerLat: number,
  customerLng: number,
  settings: Pick<ShopSettings, 'store_latitude' | 'store_longitude' | 'cod_radius_km' | 'delivery_fee_flat' | 'delivery_fee_per_km'>
): DeliveryCalc {
  const distance_km = haversineKm(
    settings.store_latitude, settings.store_longitude,
    customerLat, customerLng
  )

  const cod_available = distance_km <= settings.cod_radius_km
  const delivery_fee = cod_available
    ? settings.delivery_fee_flat
    : Math.round(settings.delivery_fee_per_km * distance_km)

  return {
    distance_km: Math.round(distance_km * 10) / 10,
    delivery_fee,
    cod_available,
  }
}
