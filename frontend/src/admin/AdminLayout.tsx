import { NavLink, Outlet, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const adminTabs = [
  { to: '/admin/chores', label: 'Chores' },
  { to: '/admin/settings', label: 'Settings' },
]

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-text-muted hover:text-text-secondary transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-text-primary">Dashboard Admin</h1>
        </div>
        <nav className="flex gap-4 mt-2">
          {adminTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-[var(--radius-button)] transition-colors ${
                  isActive
                    ? 'bg-calendar text-white'
                    : 'text-text-secondary hover:bg-bg-card-hover'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
