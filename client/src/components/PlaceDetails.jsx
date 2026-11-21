import { useEffect, useState } from 'react'
import BackButton from './BackButton.jsx'
import PhotoCarousel from './PhotoCarousel.jsx'
import StarButton from './StarButton.jsx'
import { fetchPlaceDetails, isCancel } from '../api.js'
import { useLanguage } from '../language/useLanguage.js'
import './PlaceDetails.css'

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
  const { t } = useLanguage()
  const [details, setDetails] = useState({ placeId: null, status: 'loading', aiSummary: '', photos: [] })

  useEffect(() => {
    const controller = new AbortController()
    fetchPlaceDetails(place.id, { signal: controller.signal })
      .then((loaded) => setDetails({ placeId: place.id, status: 'ready', ...loaded }))
      .catch((err) => {
        if (!isCancel(err)) setDetails({ placeId: place.id, status: 'error', aiSummary: '', photos: [] })
      })
    return () => controller.abort()
  }, [place.id])

  const current = details.placeId === place.id ? details : { status: 'loading', aiSummary: '', photos: [] }

  return (
    <section className="place-details">
      <div className="page-header">
        <BackButton onClick={onBack} />
        <h2>{place.name ?? t.stayTypes[place.type]}</h2>
        <StarButton active={saved} onClick={() => onToggleSaved(place)} />
      </div>

      <p className="place-details-coverage">
        {t.stayTypes[place.type]}
        {place.city && ` · ${place.city}`}
        {place.distanceKm > 0 && ` · ${t.distanceToCoverage}: ${place.distanceKm} km ${t.directions[place.direction] ?? ''}`}
      </p>

      <div className="place-details-summary">
        <h3>{t.aiSummary}</h3>
        {current.status === 'loading' && <p>{t.summaryLoading}</p>}
        {current.status === 'error' && <p>{t.summaryError}</p>}
        {current.status === 'ready' && <p className="place-details-text">{toPlainText(current.aiSummary)}</p>}
      </div>

      <div>
        <h3>{t.photos}</h3>
        {current.status === 'ready' && current.photos.length === 0 ? (
          <p>{t.noPhotos}</p>
        ) : (
          <PhotoCarousel photos={current.photos} />
        )}
      </div>

      <a
        className="btn btn-primary place-details-booking"
        href={place.bookingUrl}
        target="_blank"
        rel="noreferrer"
      >
        {t.bookOnBooking}
      </a>
    </section>
  )
}
