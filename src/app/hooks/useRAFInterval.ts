'use client'

import { useEffect, useRef } from 'react'

type Subscriber = {
  callback: () => void
  intervalMs: number
  lastTick: number
}

let rafId: number | null = null
const subscribers = new Set<Subscriber>()

const tick = (now: number) => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    rafId = null
    return
  }

  subscribers.forEach((sub) => {
    if (now - sub.lastTick >= sub.intervalMs) {
      sub.lastTick = now
      sub.callback()
    }
  })
  rafId = requestAnimationFrame(tick)
}

const startLoop = () => {
  if (rafId === null && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
    rafId = requestAnimationFrame(tick)
  }
}

const stopLoop = () => {
  if (subscribers.size === 0 && rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startLoop()
    } else {
      // The tick function will automatically stop when it detects hidden state
    }
  })
}

export function useRAFInterval(
  callback: () => void,
  intervalMs = 1000,
  enabled = true,
): void {
  const callbackRef = useRef(callback)
  const subscriberRef = useRef<Subscriber | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return

    const subscriber: Subscriber = {
      callback: () => callbackRef.current(),
      intervalMs,
      lastTick: performance.now(),
    }

    subscriberRef.current = subscriber
    subscribers.add(subscriber)
    startLoop()

    return () => {
      if (subscriberRef.current) {
        subscribers.delete(subscriberRef.current)
        subscriberRef.current = null
        stopLoop()
      }
    }
  }, [intervalMs, enabled])
}
