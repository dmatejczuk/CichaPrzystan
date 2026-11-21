import StarButton from './StarButton.jsx'
import { useLanguage } from '../language/useLanguage.js'

export default function ResultItem({ place, saved, onSelect, onToggleSaved }) {
  const { t } = useLanguage()

  return (
    <button className="btn result-item"  onClick={() => onSelect(place)}>
      <StarButton active={saved} onClick={() => onToggleSaved(place)} />
      <div className="result-item-info">
        <strong>{place.name ?? t.stayTypes[place.type]}</strong>
        <span>{place.city}</span>
      </div>
      <span title={t.distanceToCoverage}>{place.distanceKm} km</span>
      <button className="btn result-item-button">
        {t.next} &gt;
      </button>
    </button>
  )
}
