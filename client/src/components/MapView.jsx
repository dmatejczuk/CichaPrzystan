import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, AttributionControl, useMap } from 'react-leaflet'
import './MapView.css'

const START_CENTER = [49.25, 22.45] // Bieszczady
const START_ZOOM = 10

function MapFocus({ places, selectedPlace }) {
  const map = useMap()

  useEffect(() => {
    if (selectedPlace) {
      map.flyTo([selectedPlace.lat, selectedPlace.lng], 13)
    } else if (places.length > 0) {
      map.fitBounds(places.map((place) => [place.lat, place.lng]), { padding: [40, 40] })
    }
  }, [map, places, selectedPlace])

  return null
}

export default function MapView({ places, selectedPlace, onSelectPlace }) {
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
        <MapFocus places={places} selectedPlace={selectedPlace} />
      </MapContainer>
    </div>
  )
}
