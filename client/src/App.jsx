import { useEffect, useState } from 'react'
import AppHeader from './components/AppHeader.jsx'
import MapView from './components/MapView.jsx'
import SideMenu from './components/SideMenu.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'
import PlaceDetails from './components/PlaceDetails.jsx'
import Popup from './components/Popup.jsx'
import { searchPlaces, fetchNearbyPlaces, fetchRandomPlace } from './api.js'
import { getUserPosition } from './geolocation.js'
import { useLanguage } from './language/useLanguage.js'
import { useSavedPlaces } from './useSavedPlaces.js'

const START_VIEW = { screen: 'search', places: [], resultsTitle: 'results', selectedPlace: null }

export default function App() {
  const { t } = useLanguage()
  const { savedPlaces, isSaved, toggleSaved } = useSavedPlaces()

  const [view, setView] = useState(START_VIEW)
  const [menuOpen, setMenuOpen] = useState(false)
  const [popupMessage, setPopupMessage] = useState(null)

  const { screen, places, resultsTitle, selectedPlace } = view
  const listedPlaces = resultsTitle === 'savedPlaces' ? savedPlaces : places

  useEffect(() => {
    window.history.replaceState(START_VIEW, '')

    function handlePopState(event) {
      setView(event.state ?? START_VIEW)
      setMenuOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(nextView, { replace = false } = {}) {
    if (replace) {
      window.history.replaceState(nextView, '')
    } else {
      window.history.pushState(nextView, '')
    }
    setView(nextView)
  }

  function goBack() {
    window.history.back()
  }

  async function showResults(loadPlaces, title = 'results') {
    let loaded
    try {
      loaded = await loadPlaces()
    } catch {
      setPopupMessage(t.loadError)
      return
    }
    navigate({ screen: 'results', places: loaded, resultsTitle: title, selectedPlace: null })
  }

  function showSavedPlaces() {
    setMenuOpen(false)
    showResults(() => savedPlaces, 'savedPlaces')
  }

  function openPlace(place) {
    navigate(
      { screen: 'details', places: listedPlaces, resultsTitle, selectedPlace: place },
      { replace: screen === 'details' },
    )
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
    let place
    try {
      place = await fetchRandomPlace()
    } catch {
      setPopupMessage(t.loadError)
      return
    }
    navigate({ screen: 'details', places: [place], resultsTitle: 'results', selectedPlace: place })
  }

  return (
    <div className="app">
      <MapView
        places={screen === 'details' ? places : listedPlaces}
        selectedPlace={selectedPlace}
        onSelectPlace={openPlace}
      />

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
          places={listedPlaces}
          isSaved={isSaved}
          onToggleSaved={toggleSaved}
          onBack={goBack}
          onSelectPlace={openPlace}
        />
      )}

      {screen === 'details' && selectedPlace && (
        <PlaceDetails
          place={selectedPlace}
          saved={isSaved(selectedPlace)}
          onToggleSaved={toggleSaved}
          onBack={goBack}
        />
      )}

      <SideMenu
        open={menuOpen}
        savedCount={savedPlaces.length}
        onClose={() => setMenuOpen(false)}
        onOpenSavedPlaces={showSavedPlaces}
      />

      {popupMessage && <Popup message={popupMessage} onClose={() => setPopupMessage(null)} />}
    </div>
  )
}
