import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, AttributionControl, useMap } from 'react-leaflet'
import { getUserPosition } from '../geolocation.js'
import './MapView.css'

//jesli nie pobralo lokacji uzytkownika startujemy w Szczecinie
const START_CENTER = [53.4285, 14.5528]
const START_ZOOM = 12

function MapFocus({ places, selectedPlace, userPosition }) {
  const map = useMap()

  useEffect(() => {
    if (selectedPlace) {
      map.flyTo([selectedPlace.lat, selectedPlace.lng], 13)
    } else if (places.length > 0) {
      map.fitBounds(places.map((place) => [place.lat, place.lng]), { padding: [40, 40] })
    } else if (userPosition) {
      map.setView([userPosition.lat, userPosition.lng], START_ZOOM)
    }
  }, [map, places, selectedPlace, userPosition])

  return null
}

export default function MapView({ places, selectedPlace, onSelectPlace }) {
  const [userPosition, setUserPosition] = useState(null)

  useEffect(() => {
    let cancelled = false

    getUserPosition()
      .then((position) => {
        if (!cancelled) setUserPosition(position)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="map-view">
      <MapContainer center={START_CENTER} zoom={START_ZOOM} zoomControl={false} attributionControl={false}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors · towers: OpenCelliD (CC-BY-SA 4.0)"
        />

        {places.map((place) => {
          const isSelected = place.id === selectedPlace?.id
          return (
            <CircleMarker
              key={place.id}
              center={[place.lat, place.lng]}
              radius={isSelected ? 12 : 8}
              pathOptions={{ className: isSelected ? 'marker marker-selected' : 'marker' }}
              eventHandlers={{ click: () => onSelectPlace(place) }}
            />
          )
        })}
        
        <AttributionControl position="topright" prefix={false} />
        <MapFocus places={places} selectedPlace={selectedPlace} userPosition={userPosition} />
      </MapContainer>
    </div>
  )
}
