"use client"

import React, { memo } from "react"
import { useAssetPrice } from "../../hooks/useAssetPrice"
import { useSocketConnection } from "../providers/SocketProvider"

interface PriceRowProps {
  assetId: string
}

const PriceRow: React.FC<PriceRowProps> = memo(function PriceRow({ assetId }) {
  const { price } = useAssetPrice(assetId)

  return (
    <div className="flex items-center justify-between py-1" aria-live="polite">
      <span className="text-xs font-medium text-gray-400">{assetId}</span>
      <span className="text-sm font-semibold text-white">{price ?? "—"}</span>
    </div>
  )
})

function LivePrices({ initialAssets = ["NGN-XLM", "USD-XLM", "EUR-XLM"] }: any) {
  const { isConnected, error } = useSocketConnection()

  return (
    <div>
      <h2 className="text-sm font-bold mb-2">Live Prices</h2>
      <div className={`text-xs mb-2 ${isConnected ? "text-green-400" : "text-yellow-400"}`}>
        {isConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
      </div>
      {error && <div className="text-red-400 text-xs mb-2">Error: {error}</div>}

      <div className="space-y-1">
        {initialAssets.map((id: string) => (
          <PriceRow key={id} assetId={id} />
        ))}
      </div>
    </div>
  )
}

export default memo(LivePrices)