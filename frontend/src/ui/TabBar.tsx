import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, Music, Camera, type LucideIcon } from 'lucide-react'

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/media', label: 'Media', icon: Music },
  { to: '/cameras', label: 'Cameras', icon: Camera },
]

export function TabBar() {
  return (
    <nav
      className="flex items-center justify-center gap-[40px] bg-bg-card border-t border-border"
      style={{ height: 'var(--height-tab-bar)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-[2px] px-[14px] py-1 rounded-[var(--radius-button)] transition-colors ${
                isActive ? 'text-palette-1 bg-palette-1/10' : 'text-text-muted'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
