import AppTitle from './AppTitle.jsx'
import BackButton from './BackButton.jsx'
import { useLanguage } from '../language/useLanguage.js'
import { languages } from '../language/languages.js'
import './SideMenu.css'

export default function SideMenu({ open, onClose, onOpenSavedPlaces }) {
  const { t, language, setLanguage } = useLanguage()

  return (
    <div
      className={open ? 'side-menu-backdrop side-menu-backdrop-open' : 'side-menu-backdrop'}
      onClick={onClose}
      aria-hidden={!open}
    >
      <aside className="side-menu" onClick={(event) => event.stopPropagation()}>
        <div className="page-header">
          <BackButton onClick={onClose} />
          <AppTitle />
        </div>

        <button className="side-menu-row side-menu-item" onClick={onOpenSavedPlaces}>
          {t.savedPlaces}
        </button>

        <div className="side-menu-row">
          <span>{t.changeLanguage}</span>
          <div className="language-options">
            {languages.map(({ code, label, flag }) => (
              <button
                key={code}
                className={code === language ? 'flag-button flag-button-active' : 'flag-button'}
                onClick={() => setLanguage(code)}
                aria-label={label}
                aria-pressed={code === language}
              >
                <img src={flag} alt="" />
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
