import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import './YourEscapeScore.css'

function seededRandom(seed) {
  const text = String(seed)
  let hash = 2166136261

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  hash += hash << 13
  hash ^= hash >>> 7
  hash += hash << 3
  hash ^= hash >>> 17
  hash += hash << 5

  return (hash >>> 0) / 4294967296
}

export default function YourEscapeScore({ placeId, distanceKm = 0, visible = true }) {
  const distance = Math.max(0, Number(distanceKm) || 0)

  const score = useMemo(() => {
    if (!placeId) return null

    const distanceBonus = Math.min(10, distance)
    return Math.min(100, Math.round(50 + distanceBonus + 40 * seededRandom(placeId)))
  }, [placeId, distance])

  if (!visible || score === null) return null

  return createPortal(
    <div className="escape-score" role="status" aria-label={`Your Escape Score: ${score} out of 100`}>
      <div className="escape-score-header">
        <div className="escape-score-title">YOUR ESCAPE SCORE</div>

        <div className="escape-score-value">
          <span className="escape-score-number">{score}</span>
          <span className="escape-score-max">/100</span>
        </div>

        <div className="escape-score-label">Poza cywilizacją</div>

        <div className="escape-score-bar">
          <div className="escape-score-bar-fill" style={{ width: `${score}%` }} />
        </div>

        <p className="escape-score-note">Idealne miejsce na cyfrowy detoks.</p>
      </div>

      <div className="escape-score-details">
        <div className="escape-score-row">
          <span className="escape-score-row-name">Dostępność sieci</span>
          <strong>Minimalna</strong>
        </div>

        <div className="escape-score-row">
          <span className="escape-score-row-name">Odległość od zasięgu</span>
          <strong>{distance} km</strong>
        </div>
      </div>
    </div>,
    document.body,
  )
}