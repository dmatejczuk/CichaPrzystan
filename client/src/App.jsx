import { useState } from 'react'
import AppHeader from './components/AppHeader.jsx'
import MapView from './components/MapView.jsx'
import MenuButton from './components/MenuButton.jsx'
import SideMenu from './components/SideMenu.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'
import PlaceDetails from './components/PlaceDetails.jsx'
import Popup from './components/Popup.jsx'
import { searchPlaces, fetchNearbyPlaces, fetchRandomPlace } from './api.js'
import { getUserPosition } from './geolocation.js'
import { useLanguage } from './language/useLanguage.js'
import { useSavedPlaces } from './useSavedPlaces.js'

export default function App() {
  const { t } = useLanguage()
  const { savedPlaces, isSaved, toggleSaved } = useSavedPlaces()

  const [screen, setScreen] = useState('search')
  const [places, setPlaces] = useState([])
  const [resultsTitle, setResultsTitle] = useState('results')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [popupMessage, setPopupMessage] = useState(null)

  async function showResults(loadPlaces, title = 'results') {
    setPlaces(await loadPlaces())
    setResultsTitle(title)
    setSelectedPlace(null)
    setScreen('results')
  }

  function showSavedPlaces() {
    setMenuOpen(false)
    showResults(() => savedPlaces, 'savedPlaces')
  }

  function openPlace(place) {
    setSelectedPlace(place)
    setScreen('details')
  }

  async function findNearby() {
    let position
    try {
      position = await getUserPosition()
    } catch {
      setPopupMessage(t.locationError)
      return
    }
    await showResults(() => fetchNearbyPlaces(position))
  }

  async function openRandomPlace() {
    const place = await fetchRandomPlace()
    setPlaces([place])
    setResultsTitle('results')
    openPlace(place)
  }

  function closeSearch() {
    setPlaces([])
    setSelectedPlace(null)
    setScreen('search')
  }

  function closeDetails() {
    setSelectedPlace(null)
    setScreen('results')
  }

  return (
    <div className="app">
      <MapView places={places} selectedPlace={selectedPlace} onSelectPlace={openPlace} />

      {screen !== 'details' && <AppHeader onMenuClick={() => setMenuOpen(true)} />}

      {screen === 'search' && (
        <SearchPanel
          onSearch={(query) => showResults(() => searchPlaces(query))}
          onFindNearby={findNearby}
          onRandomPlace={openRandomPlace}
        />
      )}

      {screen === 'results' && (
        <ResultsPanel
          title={t[resultsTitle]}
          emptyMessage={resultsTitle === 'savedPlaces' ? t.noSavedPlaces : t.noResults}
          places={places}
          isSaved={isSaved}
          onToggleSaved={toggleSaved}
          onBack={closeSearch}
          onSelectPlace={openPlace}
        />
      )}

      {screen === 'details' && selectedPlace && (
        <PlaceDetails
          place={selectedPlace}
          saved={isSaved(selectedPlace)}
          onToggleSaved={toggleSaved}
          onBack={closeDetails}
        />
      )}

      {menuOpen && (
        <SideMenu onClose={() => setMenuOpen(false)} onOpenSavedPlaces={showSavedPlaces} />
      )}

      {popupMessage && <Popup message={popupMessage} onClose={() => setPopupMessage(null)} />}
    </div>
  )
}
