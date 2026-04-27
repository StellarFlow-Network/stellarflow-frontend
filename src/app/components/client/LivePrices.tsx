'use client'

import { useQuery } from '@tanstack/react-query'

export default function LivePrices({ initialData }: any) {
  const { data } = useQuery({
    queryKey: ['prices'],
    queryFn: async () => {
      const res = await fetch('/api/prices')
      return res.json()
    },
    initialData,
    refetchInterval: 15000,
  })

  return (
    <div>
      <h2>Live Prices</h2>
      {data?.map((p: any) => (
        <div key={p.symbol}>
          {p.symbol}: {p.price}
        </div>
      ))}
    </div>
  )
}