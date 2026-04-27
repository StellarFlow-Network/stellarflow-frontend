import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-gray-900 text-white p-4">
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>

      <nav className="space-y-4">
        <Link href="/">Home</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/transactions">Transactions</Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </aside>
  )
}