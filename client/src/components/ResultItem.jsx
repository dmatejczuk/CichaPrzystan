import StarButton from './StarButton.jsx'
import { useLanguage } from '../language/useLanguage.js'

export default function ResultItem({ place, saved, onSelect, onToggleSaved }) {
  const { t } = useLanguage()

  return (
    <li className="result-item">
      <StarButton active={saved} onClick={() => onToggleSaved(place)} />
      <div className="result-item-info">
        <strong>{place.name}</strong>
        <span>{place.city}</span>
      </div>
      <span>{place.distanceKm}km</span>
      <button className="btn result-item-button" onClick={() => onSelect(place)}>
        {t.next} &gt;
      </button>
    </li>
  )
}
