import MapView from './components/MapView.jsx'
import Filters from './components/Filters.jsx'
import StayCard from './components/StayCard.jsx'
import { t } from './i18n.js'

// TODO: filter state, selected stay, data fetching via api.js
export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>{t.appTitle}</h1>
        <Filters />
        <StayCard />
      </aside>
      <main className="map">
        <MapView />
      </main>
    </div>
  )
}
