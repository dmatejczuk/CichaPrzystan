import BackButton from './BackButton.jsx'
import PhotoCarousel from './PhotoCarousel.jsx'
import StarButton from './StarButton.jsx'
import { useLanguage } from '../language/useLanguage.js'
import './PlaceDetails.css'

export default function PlaceDetails({ place, saved, onToggleSaved, onBack }) {
  const { t } = useLanguage()

  return (
    <section className="place-details">
      <div className="page-header">
        <BackButton onClick={onBack} />
        <h2>{place.name}</h2>
        <StarButton active={saved} onClick={() => onToggleSaved(place)} />
      </div>

      <div className="place-details-summary">
        <h3>{t.aiSummary}</h3>
        <p>{place.aiSummary}</p>
      </div>

      <div>
        <h3>{t.photos}</h3>
        <PhotoCarousel photos={place.photos} />
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
