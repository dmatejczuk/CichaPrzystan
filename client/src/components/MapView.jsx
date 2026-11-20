import { MapContainer, TileLayer } from 'react-leaflet'

const START_CENTER = [49.25, 22.45] // Bieszczady
const START_ZOOM = 10

// TODO: ImageOverlay with dead zones, CircleMarkers for stays, moveend handler
export default function MapView() {
  return (
    <MapContainer center={START_CENTER} zoom={START_ZOOM} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors · towers: OpenCelliD (CC-BY-SA 4.0)"
      />
    </MapContainer>
  )
}
