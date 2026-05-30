import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();
  return (
    <aside className="w-64 h-screen bg-gray-900 text-white p-4">
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>

      <nav className="space-y-4">
        <Link href="/" prefetch={false} onMouseEnter={() => router.prefetch('/')}>Home</Link>
        <Link href="/analytics" prefetch={false} onMouseEnter={() => router.prefetch('/analytics')}>Analytics</Link>
        <Link href="/transactions" prefetch={false} onMouseEnter={() => router.prefetch('/transactions')}>Transactions</Link>
        <Link href="/settings" prefetch={false} onMouseEnter={() => router.prefetch('/settings')}>Settings</Link>
      </nav>
    </aside>
  )
}