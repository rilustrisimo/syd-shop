'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2, MapPin } from 'lucide-react'
import { searchPlaces, type PlaceResult } from '@/lib/routing'
import 'leaflet/dist/leaflet.css'

interface DeliveryMapProps {
  storeLat: number
  storeLng: number
  onPin: (lat: number, lng: number) => void
  pinLat?: number | null
  pinLng?: number | null
  routeCoords?: [number, number][] | null  // [lat, lng] pairs — drawn as a blue polyline
}

export function DeliveryMap({ storeLat, storeLng, onPin, pinLat, pinLng, routeCoords }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const customerMarkerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)
  const placePinRef = useRef<((lat: number, lng: number) => void) | null>(null)
  const onPinRef = useRef(onPin)
  onPinRef.current = onPin

  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Close the results dropdown on outside click/tap. Using a document
  // listener (rather than input onBlur) avoids a race on touch devices
  // where the blur can fire — and unmount the dropdown — before the tap's
  // click event reaches the result button.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let destroyed = false

    import('leaflet').then(({ default: L }) => {
      if (destroyed || !containerRef.current) return

      const customerIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      })

      const storeIcon = L.divIcon({
        className: '',
        html: '<div style="background:#ffc107;width:16px;height:16px;border-radius:50%;border:2.5px solid #0f172a;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      const map = L.map(containerRef.current!, { zoomControl: false }).setView([storeLat, storeLng], 14)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      L.marker([storeLat, storeLng], { icon: storeIcon, interactive: false })
        .bindTooltip('Store', { permanent: false, direction: 'top' })
        .addTo(map)

      function placePin(lat: number, lng: number) {
        if (customerMarkerRef.current) {
          customerMarkerRef.current.setLatLng([lat, lng])
        } else {
          customerMarkerRef.current = L.marker([lat, lng], { icon: customerIcon, draggable: true }).addTo(map)
          customerMarkerRef.current.on('dragend', () => {
            const pos = customerMarkerRef.current!.getLatLng()
            onPinRef.current(pos.lat, pos.lng)
          })
        }
        onPinRef.current(lat, lng)
      }
      placePinRef.current = placePin

      map.on('click', (e: any) => placePin(e.latlng.lat, e.latlng.lng))

      if (pinLat != null && pinLng != null) {
        placePin(pinLat, pinLng)
        map.setView([pinLat, pinLng], 15)
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (!destroyed) map.setView([pos.coords.latitude, pos.coords.longitude], 15) },
          () => {}
        )
      }

      mapRef.current = map
    })

    return () => {
      destroyed = true
      mapRef.current?.remove()
      mapRef.current = null
      customerMarkerRef.current = null
      routeLayerRef.current = null
      placePinRef.current = null
    }
  }, [storeLat, storeLng])

  // Draw / update route polyline whenever routeCoords changes
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(({ default: L }) => {
      if (!mapRef.current) return

      // Remove old route
      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
        routeLayerRef.current = null
      }

      if (!routeCoords || routeCoords.length < 2) return

      // Draw the route as a solid blue line with a slightly wider white shadow for contrast
      const shadow = L.polyline(routeCoords, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.5,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(mapRef.current)

      const line = L.polyline(routeCoords, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(mapRef.current)

      // Group both layers so we can remove them together
      routeLayerRef.current = { remove: () => { shadow.remove(); line.remove() } }

      // Fit map to show the full route with some padding
      const bounds = L.latLngBounds(routeCoords)
      mapRef.current.fitBounds(bounds, { padding: [48, 48] })
    })
  }, [routeCoords])

  // Debounced place search
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([])
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    setSearching(true)
    const t = setTimeout(() => {
      searchPlaces(query, ctrl.signal)
        .then(r => { setResults(r); setSearching(false) })
        .catch(() => setSearching(false))
    }, 450)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query])

  function selectResult(result: PlaceResult) {
    placePinRef.current?.(result.lat, result.lng)
    mapRef.current?.flyTo([result.lat, result.lng], 16, { duration: 1 })
    setQuery(result.label)
    setShowResults(false)
    setResults([])
  }

  return (
    <div className="space-y-2">
      {/* Place search */}
      <div className="relative" ref={searchWrapperRef}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowResults(true) }}
            onFocus={() => setShowResults(true)}
            placeholder="Search for a place or landmark..."
            className="w-full pl-11 pr-11 py-3.5 rounded-xl border-2 border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
          />
          {searching ? (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute z-[500] mt-1.5 w-full bg-white rounded-xl border-2 border-slate-200 shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full flex items-start gap-2.5 text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 leading-snug">{r.label}</span>
              </button>
            ))}
          </div>
        )}

        {showResults && !searching && query.trim().length >= 3 && results.length === 0 && (
          <div className="absolute z-[500] mt-1.5 w-full bg-white rounded-xl border-2 border-slate-200 shadow-lg px-4 py-3 text-sm text-slate-400">
            No places found — try a different search, or tap the map directly.
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="w-full h-[55vh] min-h-[360px] sm:h-[480px] rounded-xl overflow-hidden border-2 border-slate-200"
        style={{ zIndex: 0 }}
      />
    </div>
  )
}
