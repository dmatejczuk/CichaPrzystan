import { useState } from 'react'
import { useLanguage } from '../language/useLanguage.js'
import './SearchPanel.css'

export default function SearchPanel({ onSearch, onFindNearby, onRandomPlace }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onSearch(query)
  }

  return (
    <div className="panel">
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          className="search-form-input"
          type="text"
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="search-form-submit" type="submit" aria-label={t.search}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>
      </form>

      <div className="search-actions">
        <button className="btn" onClick={onFindNearby}>{t.findNearby}</button>
        <button className="btn" onClick={onRandomPlace}>{t.randomPlace}</button>
      </div>
    </div>
  )
}
