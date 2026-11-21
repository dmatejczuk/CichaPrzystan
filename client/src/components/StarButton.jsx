import { useId } from 'react'
import { useLanguage } from '../language/useLanguage.js'

const STAR_POINTS =
  '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'

export default function StarButton({ active, onClick }) {
  const { t } = useLanguage()
  const gradientId = useId()

  return (
    <button
      className={active ? 'star-button star-button-active' : 'star-button'}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? t.removeSavedPlace : t.savePlace}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" strokeLinejoin="round">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop className="star-gradient-start" offset="0%" />
            <stop className="star-gradient-end" offset="100%" />
          </linearGradient>
        </defs>
        <polygon className="star-fill" points={STAR_POINTS} fill={`url(#${gradientId})`} />
        <polygon points={STAR_POINTS} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  )
}