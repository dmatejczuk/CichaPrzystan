import { useEffect, useState } from 'react'
import BackButton from './BackButton.jsx'
import StarButton from './StarButton.jsx'
import { fetchPlaceDetails, isCancel } from '../api.js'
import { useLanguage } from '../language/useLanguage.js'
import './PlaceDetails.css'
import YourEscapeScore from './YourEscapeScore.jsx'

// The AI answer may contain Markdown; headings and emphasis markers are dropped and line breaks kept.
function toPlainText(markdown) {
  return markdown
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
}

export default function PlaceDetails({ place, saved, onToggleSaved, onBack }) {
  const { t, language } = useLanguage()
  const [details, setDetails] = useState({ placeId: null, language: null, status: 'loading', aiSummary: '', photos: [] })

  useEffect(() => {
    const controller = new AbortController()
    fetchPlaceDetails(place.id, { lang: language, signal: controller.signal })
      .then((loaded) => setDetails({ placeId: place.id, language, status: 'ready', ...loaded }))
      .catch((err) => {
        if (!isCancel(err)) setDetails({ placeId: place.id, language, status: 'error', aiSummary: '', photos: [] })
      })
    return () => controller.abort()
  }, [place.id, language])

  const isCurrent = details.placeId === place.id && details.language === language
  const current = isCurrent ? details : { status: 'loading', aiSummary: '', photos: [] }

  return (
    <section className="place-details">
      <div className="page-header">
        <BackButton onClick={onBack} />
        <h2>{place.name ?? t.stayTypes[place.type]}</h2>
        <StarButton active={saved} onClick={() => onToggleSaved(place)} />
      </div>

      <div className="place-details-coverage">
        <p>
          {t.stayTypes[place.type]}
          {place.city && ` · ${place.city}`}
        </p>
        <p>
          {place.distanceKm > 0 && `${t.distanceToCoverage}: ${place.distanceKm} km ${t.directions[place.direction] ?? ''}`}
        </p>
      </div>


      <div className="place-details-summary">
        <h3>{t.aiSummary}</h3>
        {current.status === 'loading' && <p>{t.summaryLoading}</p>}
        {current.status === 'error' && <p>{t.summaryError}</p>}
        {current.status === 'ready' && <p className="place-details-text">{toPlainText(current.aiSummary)}</p>}
      </div>

      <a
        className="btn btn-primary place-details-website"
        href={place.bookingUrl}
        target="_blank"
        rel="noreferrer"
      >
        {t.goToWebsite}
      </a>



      <YourEscapeScore
        placeId={place.id}
        distanceKm={place.distanceKm}
        visible={!!place?.id}
      />


    </section>
  )
}
