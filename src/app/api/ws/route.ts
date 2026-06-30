import { NextRequest, NextResponse } from 'next/server'
import { WebSocketServer, WebSocket } from 'ws'
import {
  ASSET_SYMBOL_LIST,
  ASSET_BASE_PRICES,
  ASSET_DECIMALS,
} from '@/config/assetSymbols'

// Store active connections and subscriptions
const connections = new Map<WebSocket, Set<string>>()
const assetSubscriptions = new Map<string, Set<WebSocket>>()

let wss: WebSocketServer | null = null

// Initialize WebSocket server if not already done
function getWebSocketServer() {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true })

    wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection established')
      connections.set(ws, new Set())

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: Date.now()
      }))

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message)
          handleMessage(ws, data)
        } catch (error: unknown) {
          console.error('Invalid message format:', error)
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }))
        }
      })

      ws.on('close', () => {
        console.log('WebSocket connection closed')
        cleanupConnection(ws)
      })

      ws.on('error', (error: unknown) => {
        console.error('WebSocket error:', error)
        cleanupConnection(ws)
      })
    })
  }
  return wss
}
interface SocketMessage {
  type: "subscribe" | "unsubscribe";
  assetIds?: string[];
}
function handleMessage(ws: WebSocket, data: SocketMessage) {
  const { type, assetIds } = data

  switch (type) {
    case 'subscribe':
      if (Array.isArray(assetIds)) {
        const subscribedAssets = connections.get(ws) || new Set()

        assetIds.forEach((assetId: string) => {
          subscribedAssets.add(assetId)

          if (!assetSubscriptions.has(assetId)) {
            assetSubscriptions.set(assetId, new Set())
          }
          assetSubscriptions.get(assetId)!.add(ws)
        })

        connections.set(ws, subscribedAssets)

        ws.send(JSON.stringify({
          type: 'subscription_confirmed',
          assetIds,
          timestamp: Date.now()
        }))
      }
      break

    case 'unsubscribe':
      if (Array.isArray(assetIds)) {
        const subscribedAssets = connections.get(ws) || new Set()

        assetIds.forEach((assetId: string) => {
          subscribedAssets.delete(assetId)

          const subscribers = assetSubscriptions.get(assetId)
          if (subscribers) {
            subscribers.delete(ws)
            if (subscribers.size === 0) {
              assetSubscriptions.delete(assetId)
            }
          }
        })

        connections.set(ws, subscribedAssets)
      }
      break

    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type'
      }))
  }
}

function cleanupConnection(ws: WebSocket) {
  const subscribedAssets = connections.get(ws)
  if (subscribedAssets) {
    subscribedAssets.forEach((assetId: string) => {
      const subscribers = assetSubscriptions.get(assetId)
      if (subscribers) {
        subscribers.delete(ws)
        if (subscribers.size === 0) {
          assetSubscriptions.delete(assetId)
        }
      }
    })
    connections.delete(ws)
  }
}

// Simulate price updates for demo purposes
function simulatePriceUpdates() {
  // Use the interned symbol list — single allocation, reference-equal at all
  // lookup sites.  No inline string literals needed here or downstream.
  const assets = ASSET_SYMBOL_LIST

  setInterval(() => {
    assets.forEach((assetId) => {
      const subscribers = assetSubscriptions.get(assetId)
      if (subscribers && subscribers.size > 0) {
        // O(1) map lookup replaces chained ternary conditionals.
        const basePrice = ASSET_BASE_PRICES[assetId]
        const variation = (Math.random() - 0.5) * 0.02 // ±1% variation
        const newPrice = basePrice * (1 + variation)

        const update = {
          type: Math.random() > 0.7 ? 'delta_update' : 'price_update',
          assetId,
          data: {
            id: assetId,
            assetPair: assetId,
            price: newPrice,
            decimals: ASSET_DECIMALS[assetId],
            source: 'stellarflow-oracle',
            timestamp: Date.now(),
            confidenceScore: 0.95 + Math.random() * 0.04
          },
          timestamp: Date.now()
        }

        subscribers.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(update))
          }
        })
      }
    })
  }, 2000 + Math.random() * 3000) // Random interval between 2-5 seconds
}

// Start simulation after a delay
setTimeout(simulatePriceUpdates, 1000)

export async function GET(_request: NextRequest) {
  // This is a placeholder - WebSocket upgrade happens in the Next.js server
  return new NextResponse('WebSocket endpoint', { status: 200 })
}

// Export for use in server.js or custom server setup
export { getWebSocketServer, assetSubscriptions }
