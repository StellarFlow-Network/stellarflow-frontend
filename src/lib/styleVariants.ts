/**
 * Style Variants Utility
 * 
 * Centralizes dynamic style updates using class markers and dataset tags
 * instead of inline style manipulation.
 * 
 * Issue #165: Isolating Dynamic Style Updates
 */

export const priceIndicatorVariants = {
    up: {
        container: 'bg-emerald-500/10 border-emerald-500/20',
        text: 'text-emerald-400',
        glow: 'shadow-[0_0_18px_rgba(52,211,153,0.18)]',
        arrow: '↑',
    },
    down: {
        container: 'bg-rose-500/10 border-rose-500/20',
        text: 'text-rose-400',
        glow: 'shadow-[0_0_18px_rgba(244,63,94,0.18)]',
        arrow: '↓',
    },
} as const

export const connectionStatusVariants = {
    connected: {
        indicator: 'bg-emerald-500',
        pulse: 'animate-pulse',
        text: 'text-emerald-400',
        label: 'Connected',
    },
    disconnected: {
        indicator: 'bg-rose-500',
        pulse: '',
        text: 'text-rose-400',
        label: 'Disconnected',
    },
    reconnecting: {
        indicator: 'bg-yellow-500',
        pulse: 'animate-pulse',
        text: 'text-yellow-400',
        label: 'Reconnecting',
    },
} as const

export const loadingStateVariants = {
    loading: {
        opacity: 'opacity-50',
        pointer: 'pointer-events-none',
    },
    ready: {
        opacity: 'opacity-100',
        pointer: 'pointer-events-auto',
    },
} as const

/**
 * Get trend indicator classes based on value direction
 */
export function getTrendClasses(isUp: boolean) {
    return isUp ? priceIndicatorVariants.up : priceIndicatorVariants.down
}

/**
 * Get connection status classes
 */
export function getConnectionStatusClasses(
    status: 'connected' | 'disconnected' | 'reconnecting',
) {
    return connectionStatusVariants[status]
}

/**
 * Get loading state classes
 */
export function getLoadingStateClasses(isLoading: boolean) {
    return isLoading
        ? loadingStateVariants.loading
        : loadingStateVariants.ready
}

/**
 * Combine multiple variant classes
 */
export function combineVariantClasses(...classes: (string | undefined)[]): string {
    return classes.filter(Boolean).join(' ')
}
