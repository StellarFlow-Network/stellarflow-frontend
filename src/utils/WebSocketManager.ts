"use client";

import { PriceData } from "@/types";

interface SocketMessage {
  type: "price_update" | "delta_update";
  assetId?: string;
  data: PriceData | Partial<PriceData>;
  timestamp: number;
}

type MessageCallback = (data: PriceData | Partial<PriceData>) => void;
type StatusCallback = (connected: boolean) => void;

export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  
  // Track listeners for data streams and connection statuses
  private messageListeners: Set<MessageCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  
  // Keep an aggregated set of all sub-assets requested by various hooks
  private globalSubscribedAssets: Set<string> = new Set();
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

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
            this.messageListeners.forEach((callback) => callback(message.data));
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

  // Subscribe a component listener to message data events
  public subscribeToMessages(callback: MessageCallback) {
    this.messageListeners.add(callback);
  }

  public unsubscribeFromMessages(callback: MessageCallback) {
    this.messageListeners.delete(callback);
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