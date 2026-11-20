import { useContext } from 'react'
import { LanguageContext } from './languageContext.js'

export function useLanguage() {
  return useContext(LanguageContext)
}
