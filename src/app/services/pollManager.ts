'use client'

/**
 * Centralized Polling Manager
 * 
 * Manages a single shared polling loop for all financial ticker data.
 * Prevents multiple independent polling connections that cause browser thread locking.
 * 
 * Issue #151: Shared Poll Controls for Financial Tickers
 */

interface PollSubscriber {
    id: string
    assetIds: string[]
    callback: (data: Record<string, unknown>) => void
    interval: number
    lastPoll: number
}

class PollManager {
    private subscribers = new Map<string, PollSubscriber>()
    private rafId: number | null = null
    private lastFrameTime = 0
    private pollData = new Map<string, unknown>()

    /**
     * Subscribe to polling updates for specific assets
     */
    subscribe(
        id: string,
        assetIds: string[],
        callback: (data: Record<string, unknown>) => void,
        interval: number = 30000,
    ): () => void {
        const subscriber: PollSubscriber = {
            id,
            assetIds,
            callback,
            interval,
            lastPoll: 0,
        }

        this.subscribers.set(id, subscriber)
        this.startPolling()

        // Return unsubscribe function
        return () => this.unsubscribe(id)
    }

    /**
     * Unsubscribe from polling
     */
    unsubscribe(id: string): void {
        this.subscribers.delete(id)
        if (this.subscribers.size === 0) {
            this.stopPolling()
        }
    }

    /**
     * Update poll data (called by WebSocket or REST layer)
     */
    updateData(assetId: string, data: unknown): void {
        this.pollData.set(assetId, data)
    }

    /**
     * Get current poll data for an asset
     */
    getData(assetId: string): unknown {
        return this.pollData.get(assetId)
    }

    /**
     * Start the shared polling loop using RAF
     */
    private startPolling(): void {
        if (this.rafId !== null) return

        const poll = (currentTime: number) => {
            this.lastFrameTime = currentTime

            // Check each subscriber's interval
            this.subscribers.forEach((subscriber) => {
                if (currentTime - subscriber.lastPoll >= subscriber.interval) {
                    subscriber.lastPoll = currentTime

                    // Collect data for this subscriber's assets
                    const data: Record<string, unknown> = {}
                    subscriber.assetIds.forEach((assetId) => {
                        data[assetId] = this.pollData.get(assetId)
                    })

                    // Call subscriber callback with batched data
                    subscriber.callback(data)
                }
            })

            // Continue polling if subscribers exist
            if (this.subscribers.size > 0) {
                this.rafId = requestAnimationFrame(poll)
            } else {
                this.rafId = null
            }
        }

        this.rafId = requestAnimationFrame(poll)
    }

    /**
     * Stop the polling loop
     */
    private stopPolling(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
    }

    /**
     * Clear all subscribers and stop polling
     */
    clear(): void {
        this.subscribers.clear()
        this.pollData.clear()
        this.stopPolling()
    }
}

// Export singleton instance
export const pollManager = new PollManager()
