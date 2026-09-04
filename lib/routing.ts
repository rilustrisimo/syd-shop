import { haversineKm } from './haversine'

export interface PlaceResult {
  lat: number
  lng: number
  label: string
}

/**
 * Forward-geocode a free-text place name (e.g. "Cagayan de Oro City Hall")
 * to candidate lat/lng locations via Nominatim (OpenStreetMap), restricted
 * to the Philippines. Used by the delivery map's place search box so
 * customers can jump to a location by name instead of hunting for it by
 * panning/zooming.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=ph&limit=6&addressdetails=0`
  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': 'SYD-Construction-Shop/1.0' },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data as any[]).map(r => ({
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: r.display_name as string,
  }))
}

// Public OSRM demo server — uses OpenStreetMap road network globally.
// Coordinates are lon,lat order (GeoJSON convention).
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

export interface RoadDistanceResult {
  distance_km: number
  road_based: boolean           // false = Haversine fallback (no road data or network error)
  routeCoords?: [number, number][]  // [lat, lng] pairs for drawing the route on a map (only when road_based)
}

/**
 * Returns the road driving distance between two coordinates using OSRM.
 * If the destination has no mapped road, OSRM automatically snaps to the
 * nearest road node and routes from there, so remote/off-road pins are
 * handled gracefully.
 *
 * Falls back to straight-line Haversine if OSRM is unreachable or returns
 * no route (e.g. islands, disconnected road networks).
 *
 * Pass an AbortSignal to cancel in-flight requests when the pin moves.
 */
export async function getRoadDistance(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  signal?: AbortSignal
): Promise<RoadDistanceResult> {
  try {
    // overview=full + geometries=geojson returns the route shape as a GeoJSON LineString
    const url = `${OSRM}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=false`
    const res = await fetch(url, { signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No route')

    const route = data.routes[0]
    const km = route.distance / 1000

    // GeoJSON coordinates are [lng, lat] — flip to [lat, lng] for Leaflet
    const routeCoords: [number, number][] = (route.geometry?.coordinates ?? []).map(
      ([lng, lat]: [number, number]) => [lat, lng]
    )

    return { distance_km: Math.round(km * 10) / 10, road_based: true, routeCoords }
  } catch (err: any) {
    // Re-throw aborts so callers can tell the request was cancelled
    if (err?.name === 'AbortError') throw err
    // Any other error (network, no route, timeout) → Haversine fallback
    const km = haversineKm(fromLat, fromLng, toLat, toLng)
    return { distance_km: Math.round(km * 10) / 10, road_based: false }
  }
}
