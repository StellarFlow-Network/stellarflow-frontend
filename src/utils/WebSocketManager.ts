"use client";

import { PriceData, OrderBookSnapshot } from "@/types";

interface SocketMessage {
  type: "price_update" | "delta_update" | "orderbook_update";
  assetId?: string;
  data: PriceData | Partial<PriceData> | OrderBookSnapshot;
  timestamp: number;
}

type MessageCallback = (data: PriceData | Partial<PriceData>) => void;
type OrderBookCallback = (data: OrderBookSnapshot) => void;
type StatusCallback = (connected: boolean) => void;

export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  
  // Track listeners for data streams and connection statuses
  private messageListeners: Set<MessageCallback> = new Set();
  private orderBookListeners: Set<OrderBookCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  
  // Keep an aggregated set of all sub-assets requested by various hooks
  private globalSubscribedAssets: Set<string> = new Set();
  private isConnected: boolean = false;

  // Reference count of active consumers. When this drops to 0 the underlying
  // WebSocket is torn down so background work stops. It is re-established on
  // the next `addConsumer()` call.
  private consumerCount: number = 0;

  private constructor() {}

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  // ---- consumer lifecycle --------------------------------------------------

  /** Register an active consumer. Connects the socket if this is the first. */
  public addConsumer(): void {
    this.consumerCount++;
    if (this.consumerCount === 1) {
      this.connect();
    }
  }

  /** Deregister a consumer. Tears down the socket when no consumers remain. */
  public removeConsumer(): void {
    this.consumerCount = Math.max(0, this.consumerCount - 1);
    if (this.consumerCount === 0) {
      this.disconnect();
    }
  }

  // ---- connection management -----------------------------------------------

  public connect() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatusListeners(true);
        this.resendGlobalSubscriptions();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: SocketMessage = JSON.parse(event.data as string);
          if (message.type === "price_update" || message.type === "delta_update") {
            // Distribute the incoming data packets down to all observer instances
            this.messageListeners.forEach((callback) =>
              callback(message.data as PriceData | Partial<PriceData>),
            );
          } else if (message.type === "orderbook_update") {
            this.orderBookListeners.forEach((callback) =>
              callback(message.data as OrderBookSnapshot),
            );
          }
        } catch (err) {
          console.error("Failed to parse centralized WebSocket message:", err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatusListeners(false);
      };

      this.ws.onerror = (event: Event) => {
        console.error("Centralized WebSocket error:", event);
      };
    } catch (err) {
      console.error("Failed to establish centralized WebSocket connection", err);
    }
  }

  /** Close the WebSocket and clear all server-side subscriptions. */
  private disconnect() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.globalSubscribedAssets.clear();
    this.notifyStatusListeners(false);
  }

  // Subscribe a component listener to message data events
  public subscribeToMessages(callback: MessageCallback) {
    this.messageListeners.add(callback);
  }

  public unsubscribeFromMessages(callback: MessageCallback) {
    this.messageListeners.delete(callback);
  }

  // Subscribe a component listener to order book snapshot events
  public subscribeToOrderBook(callback: OrderBookCallback) {
    this.orderBookListeners.add(callback);
  }

  public unsubscribeFromOrderBook(callback: OrderBookCallback) {
    this.orderBookListeners.delete(callback);
  }

  // Subscribe a component listener to status change events
  public subscribeToStatus(callback: StatusCallback) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
  }

  public unsubscribeFromStatus(callback: StatusCallback) {
    this.statusListeners.delete(callback);
  }

  // Dynamic asset registration commands sent up to raw socket pipeline
  public subscribeToAssets(assetIds: string[]) {
    let checkNew = false;
    assetIds.forEach(id => {
      if (!this.globalSubscribedAssets.has(id)) {
        this.globalSubscribedAssets.add(id);
        checkNew = true;
      }
    });

    if (checkNew && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", assetIds }));
    }
  }

  public unsubscribeFromAssets(assetIds: string[]) {
    // Keep assets subscribed if other components might still need them, 
    // but for simple pool consolidation, we send the unsubscribe context downstream.
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "unsubscribe", assetIds }));
    }
    assetIds.forEach(id => this.globalSubscribedAssets.delete(id));
  }

  private resendGlobalSubscriptions() {
    if (this.globalSubscribedAssets.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "subscribe",
        assetIds: Array.from(this.globalSubscribedAssets),
      }));
    }
  }

  private notifyStatusListeners(status: boolean) {
    this.statusListeners.forEach((callback) => callback(status));
  }

  public getConnectedStatus(): boolean {
    return this.isConnected;
  }
}