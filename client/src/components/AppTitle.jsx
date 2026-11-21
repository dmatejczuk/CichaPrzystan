import titleImage from '../assets/images/title.png'
import { useLanguage } from '../language/useLanguage.js'

export default function AppTitle() {
  const { t } = useLanguage()

  return <img className="app-title" src={titleImage} alt={t.appTitle} />
}