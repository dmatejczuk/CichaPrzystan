import { useEffect, useState } from 'react'
import { LanguageContext } from './languageContext.js'
import { translations } from '../i18n.js'

const STORAGE_KEY = 'language'

function getInitialLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved in translations) return saved
  return navigator.language.startsWith('pl') ? 'pl' : 'en'
}

export default function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = { language, setLanguage, t: translations[language] }

  return <LanguageContext value={value}>{children}</LanguageContext>
}
