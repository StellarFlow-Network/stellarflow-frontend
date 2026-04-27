import LivePrices from './components/client/LivePrices'
import dynamic from 'next/dynamic'

// Lazy load heavy client components
const MapWidget = dynamic(() => import('./components/client/MapWidget'), {
  ssr: false,
})

export default async function DashboardPage() {
  // Server-side fetch (fast, cached)
  const initialPrices = await fetch('http://localhost:3000/api/prices', {
    next: { revalidate: 30 }, // ISR caching
  }).then(res => res.json())

  return (
    <main className="p-6 space-y-6">
      
      {/* Server-rendered section */}
      <section>
        <h2 className="text-xl font-bold">Overview</h2>
      </section>

      {/* Client interactive components */}
      <LivePrices initialData={initialPrices} />
      <MapWidget />
    </main>
  )
}