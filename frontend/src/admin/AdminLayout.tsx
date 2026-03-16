import { NavLink, Outlet } from 'react-router-dom'

const adminTabs = [
  { to: '/admin/chores', label: 'Chores' },
  { to: '/admin/lunch-menu', label: 'Lunch Menu' },
]

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-bg-card border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Dashboard Admin</h1>
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
      <main className="p-6 max-w-4xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
