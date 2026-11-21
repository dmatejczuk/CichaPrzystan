import { useEffect } from 'react'
import { useLanguage } from '../language/useLanguage.js'
import './Popup.css'

export default function Popup({ message, onClose }) {
  const { t } = useLanguage()

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="popup" role="alertdialog" onClick={(event) => event.stopPropagation()}>
        <p className="popup-message">{message}</p>
        <button className="btn btn-primary" onClick={onClose}>{t.close}</button>
      </div>
    </div>
  )
}
