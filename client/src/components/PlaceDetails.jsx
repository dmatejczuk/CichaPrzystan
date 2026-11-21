import { useEffect, useState } from 'react'
import BackButton from './BackButton.jsx'
import StarButton from './StarButton.jsx'
import { fetchPlaceDetails, isCancel } from '../api.js'
import { useLanguage } from '../language/useLanguage.js'
import './PlaceDetails.css'
import YourEscapeScore from './YourEscapeScore.jsx'


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

  const summary = current.status === 'ready' ? parseSummary(current.aiSummary) : null
  const sections = summary
    ? Object.entries(summary).filter(([key]) => key !== 'website')
    : []

  return (
    <section className="place-details">
      <div className="page-header">
        <BackButton onClick={onBack} />
        <h2>{place.name ?? t.stayTypes[place.type]}</h2>
        <StarButton active={saved} onClick={() => onToggleSaved(place)} />
      </div>

      <div className="place-details-coverage">
        <p className='coverage-city'>
          {t.stayTypes[place.type]}
          {place.city && ` •  ${place.city}`}
        </p>
        <p>
          {place.distanceKm > 0 && `${t.distanceToCoverage}: ${place.distanceKm} km ${t.directions[place.direction] ?? ''}`}
        </p>
      </div>


      <div className="place-details-summary">
        {current.status === 'loading' && (
          <div className="place-details-card">
            <p>{t.summaryLoading}</p>
          </div>
        )}

        {current.status === 'error' && (
          <div className="place-details-card">
            <p>{t.summaryError}</p>
          </div>
        )}

        {current.status === 'ready' && !summary && (
          <div className="place-details-card">
            <p>{t.summaryError}</p>
          </div>
        )} 

        {sections.map(([key, text]) => (
          <div key={key} className="place-details-item">
            <h2>{key}:</h2>
            <div className="place-details-card">
              <p className="place-details-text">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className='aiSummary'>{t.aiSummary}</p>
      { summary && summary.website && 
        <a
          className="btn btn-primary place-details-website"
          href={summary.website}
          target="_blank"
          rel="noreferrer"
        >
          {t.goToWebsite}
        </a>
      }

      <YourEscapeScore
        placeId={place.id}
        distanceKm={place.distanceKm}
        visible={!!place?.id}
      />
    </section>
  )
}

export function parseSummary(raw) {
  if (typeof raw !== 'string') return raw

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    return typeof parsed === 'string' ? parseSummary(parsed) : parsed
  } catch {
    return null
  }
}