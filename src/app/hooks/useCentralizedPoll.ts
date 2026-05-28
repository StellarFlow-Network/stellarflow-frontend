'use client'

import { useEffect, useRef, useCallback } from 'react'
import { pollManager } from '../services/pollManager'

interface UseCentralizedPollOptions {
    assetIds: string[]
    interval?: number
    enabled?: boolean
}

interface UseCentralizedPollReturn {
    data: Record<string, unknown>
    isPolling: boolean
}

/**
 * Hook to subscribe to centralized polling for financial tickers
 * 
 * Replaces independent polling connections with a shared event pipeline.
 * Issue #151: Shared Poll Controls for Financial Tickers
 */
export function useCentralizedPoll({
    assetIds,
    interval = 30000,
    enabled = true,
}: UseCentralizedPollOptions): UseCentralizedPollReturn {
    const subscriberIdRef = useRef(`poll-${Math.random().toString(36).slice(2)}`)
    const dataRef = useRef<Record<string, unknown>>({})

    const handlePollData = useCallback((data: Record<string, unknown>) => {
        dataRef.current = data
    }, [])

    useEffect(() => {
        if (!enabled || assetIds.length === 0) return

        const unsubscribe = pollManager.subscribe(
            subscriberIdRef.current,
            assetIds,
            handlePollData,
            interval,
        )

        return unsubscribe
    }, [assetIds, interval, enabled, handlePollData])

    return {
        data: dataRef.current,
        isPolling: enabled,
    }
}
