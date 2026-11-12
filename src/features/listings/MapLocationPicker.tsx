import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { useTranslation } from 'react-i18next'

const locationPinIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

type Coordinates = {
  latitude: number
  longitude: number
}

type Props = {
  latitude: number | null
  longitude: number | null
  onChange: (coordinates: Coordinates | null) => void
}

export function MapLocationPicker({ latitude, longitude, onChange }: Props) {
  const { t } = useTranslation()
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const coordinatesRef = useRef<Coordinates | null>(null)
  const onChangeRef = useRef(onChange)
  const hasPin = latitude !== null && longitude !== null

  useEffect(() => {
    coordinatesRef.current = hasPin ? { latitude, longitude } : null
    onChangeRef.current = onChange
  }, [latitude, longitude, hasPin, onChange])

  useEffect(() => {
    if (!mapElementRef.current) return

    const coordinates = coordinatesRef.current
    const initialCenter: L.LatLngExpression = coordinates
      ? [coordinates.latitude, coordinates.longitude]
      : [50.1109, 8.6821]
    const map = L.map(mapElementRef.current).setView(initialCenter, coordinates ? 15 : 5)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    if (coordinates) {
      markerRef.current = L.marker([coordinates.latitude, coordinates.longitude], { icon: locationPinIcon }).addTo(map)
    }

    map.on('click', (event: L.LeafletMouseEvent) => {
      const coordinates = { latitude: event.latlng.lat, longitude: event.latlng.lng }
      if (markerRef.current) markerRef.current.setLatLng(event.latlng)
      else markerRef.current = L.marker(event.latlng, { icon: locationPinIcon }).addTo(map)
      onChangeRef.current(coordinates)
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    if (!hasPin) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    const coordinates: L.LatLngExpression = [latitude, longitude]
    if (markerRef.current) markerRef.current.setLatLng(coordinates)
    else markerRef.current = L.marker(coordinates, { icon: locationPinIcon }).addTo(mapRef.current)
  }, [latitude, longitude, hasPin])

  return (
    <div className="listing-map-picker">
      <div className="listing-map-canvas" ref={mapElementRef} role="application" aria-label={t('houseLocationMap')} />
      <p className="arrangement-hint">{t('clickMapToPin')}</p>
      {hasPin && (
        <div className="listing-map-pin-details">
          <span>{t('houseLocationPinned', { latitude: latitude.toFixed(5), longitude: longitude.toFixed(5) })}</span>
          <button className="text-button" type="button" onClick={() => onChange(null)}>{t('removeHouseLocationPin')}</button>
        </div>
      )}
    </div>
  )
}
