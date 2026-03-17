import { Outlet, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

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
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
