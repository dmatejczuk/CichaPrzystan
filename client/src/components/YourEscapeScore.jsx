
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '../useMediaQuery.js'
import { useLanguage } from '../language/useLanguage.js'
import './YourEscapeScore.css'

export function calculateEscapeScore(distanceKm) {
  const distance = Number(distanceKm)

  if (!Number.isFinite(distance) || distance < 0) return null

  // Distance-based isolation proxy.
  // 12 km is the scale at which the score rises progressively.
  const score = 50 + 50 * Math.pow(Math.min(distance / 20, 1), 0.5);

  return Math.round(Math.min(100, Math.max(0, score)))
}

export default function YourEscapeScore({
  placeId,
  distanceKm,
  visible = true,
}) {
  const { t } = useLanguage()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const score = useMemo(
    () => calculateEscapeScore(distanceKm),
    [distanceKm]
  )

  const distance = Number(distanceKm)

  if (!visible || !placeId || score === null) return null

  const card = (
    <div
      className="escape-score"
      role="status"
      aria-label={t.escapeScoreAria.replace('{score}', score)}
    >
      <div className="escape-score-header">
        <div className="escape-score-title">
          {t.escapeScoreTitle}
        </div>

        <div className="escape-score-value">
          <span className="escape-score-number">{score}</span>
          <span className="escape-score-max">/100</span>
        </div>

        <div className="escape-score-label">
          {t.escapeScoreVerdict}
        </div>

        <div className="escape-score-bar">
          <div
            className="escape-score-bar-fill"
            style={{ width: `${score}%` }}
          />
        </div>

        <p className="escape-score-note">
          {t.escapeScoreNote}
        </p>
      </div>

      <div className="escape-score-details">
        <div className="escape-score-row">
          <span className="escape-score-row-name">
            {t.escapeScoreDistance}
          </span>
          <strong>{distance} km</strong>
        </div>

        <div className="escape-score-row">
          <span className="escape-score-row-name">
            {t.escapeScoreNetwork}
          </span>
          <strong>{t.escapeScoreNetworkMinimal}</strong>
        </div>
      </div>
    </div>
  )

  return isDesktop
    ? createPortal(card, document.body)
    : card
}
