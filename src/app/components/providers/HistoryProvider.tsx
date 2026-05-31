'use client'

import { ReactNode } from 'react'
import { useHistoricalSync } from '@/app/hooks/useHistoricalSync'

interface HistoryProviderProps {
  children: ReactNode
  enabled?: boolean
}

export function HistoryProvider({ children, enabled = true }: HistoryProviderProps) {
  useHistoricalSync(enabled)

  return <>{children}</>
}
