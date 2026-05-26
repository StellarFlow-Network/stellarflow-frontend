export const api = {
  async getPrices() {
    const res = await fetch('/api/prices')
    if (!res.ok) throw new Error('Failed to fetch prices')
    return res.json()
  },

  async getPricesWithSignal(signal?: AbortSignal) {
    const res = await fetch('/api/prices', { signal })
    if (!res.ok) throw new Error('Failed to fetch prices')
    return res.json()
  },

  async getPortfolioWithSignal(signal?: AbortSignal) {
    const res = await fetch('/api/portfolio', { signal })
    if (!res.ok) throw new Error('Failed to fetch portfolio')
    return res.json()
  },
}