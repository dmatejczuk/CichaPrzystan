import { useLanguage } from '../language/useLanguage.js'

export default function BackButton({ onClick }) {
  const { t } = useLanguage()

  return (
    <button className="back-button" onClick={onClick} aria-label={t.back}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#404040"
           strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}
