'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface DeliveryMapProps {
  storeLat: number
  storeLng: number
  onPin: (lat: number, lng: number) => void
  pinLat?: number | null
  pinLng?: number | null
}

export function DeliveryMap({ storeLat, storeLng, onPin, pinLat, pinLng }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const customerMarkerRef = useRef<any>(null)
  const onPinRef = useRef(onPin)
  onPinRef.current = onPin

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
        html: '<div style="background:#f97316;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const map = L.map(containerRef.current!).setView([storeLat, storeLng], 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      L.marker([storeLat, storeLng], { icon: storeIcon, interactive: false }).addTo(map)

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
    }
  }, [storeLat, storeLng])

  return <div ref={containerRef} className="w-full h-56 rounded-xl overflow-hidden" style={{ zIndex: 0 }} />
}
