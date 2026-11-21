import MenuButton from './MenuButton.jsx'
import AppTitle from './AppTitle.jsx'
import './AppHeader.css'

export default function AppHeader({ onMenuClick }) {
  return (
    <header className="app-header">
      <MenuButton onClick={onMenuClick} />
      <AppTitle />
    </header>
  )
}