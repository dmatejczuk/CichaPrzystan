import { useLanguage } from '../language/useLanguage.js'

export default function StarButton({ active, onClick }) {
  const { t } = useLanguage()

  return (
    <button
      className={active ? 'star-button star-button-active' : 'star-button'}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? t.removeSavedPlace : t.savePlace}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
           stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  )
}
