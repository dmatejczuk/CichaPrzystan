import StarButton from './StarButton.jsx'
import { useLanguage } from '../language/useLanguage.js'

export default function ResultItem({ place, saved, onSelect, onToggleSaved }) {
  const { t } = useLanguage()
  const distanceKm = place.distanceKm === 0 ? 0.1 : place.distanceKm

  return (
    <li className="result-item">
      <StarButton active={saved} onClick={() => onToggleSaved(place)} />
      <button className="result-item-main" onClick={() => onSelect(place)}>
        <span className="result-item-info">
          <strong>{place.name ?? t.stayTypes[place.type]}</strong>
          <span>{place.city}</span>
        </span>
        <span title={t.distanceToCoverage}>{distanceKm} km</span>
        <span className="btn result-item-button">
          {t.next} &gt;
        </span>
      </button>
    </li>
  )
}
