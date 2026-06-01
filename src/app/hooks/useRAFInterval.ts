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
  subscribers.forEach((sub) => {
    if (now - sub.lastTick >= sub.intervalMs) {
      sub.lastTick = now
      sub.callback()
    }
  })
  rafId = requestAnimationFrame(tick)
}

const startLoop = () => {
  if (rafId === null) {
    rafId = requestAnimationFrame(tick)
  }
}

const stopLoop = () => {
  if (subscribers.size === 0 && rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
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
