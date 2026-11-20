import BackButton from './BackButton.jsx'
import ResultItem from './ResultItem.jsx'
import './ResultsPanel.css'

export default function ResultsPanel({
  title,
  emptyMessage,
  places,
  isSaved,
  onToggleSaved,
  onBack,
  onSelectPlace,
}) {
  return (
    <div className="panel results-panel">
      <div className="page-header">
        <BackButton onClick={onBack} />
        <h2>{title} ({places.length})</h2>
      </div>

      {places.length === 0 ? (
        <p className="results-panel-empty">{emptyMessage}</p>
      ) : (
        <ul className="results-list">
          {places.map((place) => (
            <ResultItem
              key={place.id}
              place={place}
              saved={isSaved(place)}
              onSelect={onSelectPlace}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
