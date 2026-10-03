"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  Bell,
  BarChart3,
  Zap,
  WifiOff,
  Settings,
  Smartphone,
  ArrowRight,
  Info,
} from "lucide-react";
const OfflineBanner = dynamic(() => import("@/components/pwa/OfflineBanner").then((module) => module.OfflineBanner), { ssr: false });
const PushNotificationManager = dynamic(() => import("@/components/notifications/PushNotificationManager").then((module) => module.PushNotificationManager), { ssr: false });
const HarvestHistoryModal = dynamic(() => import("@/components/yield/HarvestHistoryModal").then((module) => module.HarvestHistoryModal), { ssr: false });
const OrderBookView = dynamic(() => import("@/components/trading/OrderBookView").then((module) => module.OrderBookView), { ssr: false });
const NotificationPreferencesPanel = dynamic(() => import("@/components/settings/NotificationPreferencesPanel").then((module) => module.NotificationPreferencesPanel), { ssr: false });

/**
 * Demo page showcasing all new PWA and notification components
 * 
 * This page demonstrates:
 * - PWA Offline Status Banner
 * - Push Notification Manager
 * - Yield Vault Harvest History Modal  
 * - Real-time Order Book View
 * - Notification Preferences Panel
 */
export default function DemoPage() {
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);

  // Simulate offline state for demo
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (forceOffline) {
      // Override navigator.onLine for demo
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      window.dispatchEvent(new Event('offline'));
    } else {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      window.dispatchEvent(new Event('online'));
    }
  }, [forceOffline]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold mb-4">StellarFlow PWA Features Demo</h1>
          <p className="text-neutral-400 max-w-2xl mx-auto">
            Comprehensive demonstration of Progressive Web App capabilities, push notifications, 
            yield vault management, and real-time trading components.
          </p>
        </div>

        {/* Demo Controls */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-400" />
            Demo Controls
          </h2>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setForceOffline(!forceOffline)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                forceOffline
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              <WifiOff className="h-4 w-4" />
              {forceOffline ? 'Go Online' : 'Simulate Offline'}
            </button>

            <button
              onClick={() => setShowNotificationModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
            >
              <Bell className="h-4 w-4" />
              Open Notification Manager
            </button>

            <button
              onClick={() => setShowHarvestModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
            >
              <Zap className="h-4 w-4" />
              View Harvest History
            </button>
          </div>
        </div>

        {/* Component Showcase Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Real-time Order Book */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              <h2 className="text-xl font-semibold">Real-time Order Book</h2>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="h-[600px]">
                <OrderBookView 
                  pair="XLM/USDC" 
                  depth={15} 
                  enableGrouping 
                  compact={false}
                />
              </div>
            </div>
            <div className="text-sm text-neutral-400 bg-neutral-900/50 border border-neutral-800 rounded-lg p-3">
              <p><strong>Features:</strong></p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                <li>Virtualized rendering with react-window for smooth performance</li>
                <li>Real-time WebSocket updates with smooth animations</li>
                <li>Price grouping (0.01, 0.1, 1.0, 10.0 step sizes)</li>
                <li>Depth visualization bars behind volume numbers</li>
                <li>Handles 50+ delta messages per second without frame drops</li>
                <li>Fallback polling if WebSocket connection drops</li>
              </ul>
            </div>
          </div>

          {/* Notification Preferences Panel */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-semibold">Push Notification Preferences</h2>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 max-h-[600px] overflow-y-auto">
              <NotificationPreferencesPanel compact />
            </div>
            <div className="text-sm text-neutral-400 bg-neutral-900/50 border border-neutral-800 rounded-lg p-3">
              <p><strong>Features:</strong></p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                <li>Browser notification permission management</li>
                <li>Individual trigger preferences (price, health factor, harvests)</li>
                <li>Sound and quiet hours settings</li>
                <li>Test notification functionality</li>
                <li>Cross-browser compatibility detection</li>
              </ul>
            </div>
          </div>
        </div>

        {/* PWA Features Showcase */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-400" />
            Progressive Web App Features
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <WifiOff className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold">Offline Support</h3>
              </div>
              <p className="text-sm text-neutral-400 mb-3">
                App loads basic UI shell offline without crashing. Cache static assets and core token lists.
              </p>
              <div className="text-xs text-neutral-500">
                <p>✓ Offline page with cached data indicators</p>
                <p>✓ Network status banner with auto-hide</p>
                <p>✓ Service worker caching layer</p>
              </div>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold">Push Notifications</h3>
              </div>
              <p className="text-sm text-neutral-400 mb-3">
                Desktop alerts for price targets and vault liquidation warnings.
              </p>
              <div className="text-xs text-neutral-500">
                <p>✓ Browser permission management</p>
                <p>✓ Custom trigger preferences</p>
                <p>✓ Instant opt-out functionality</p>
              </div>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="h-5 w-5 text-purple-400" />
                <h3 className="font-semibold">Install Prompts</h3>
              </div>
              <p className="text-sm text-neutral-400 mb-3">
                'Add to Home Screen' installation prompt banner for mobile users.
              </p>
              <div className="text-xs text-neutral-500">
                <p>✓ iOS Safari installation guide</p>
                <p>✓ Android Chrome native prompt</p>
                <p>✓ Platform-specific instructions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-200 mb-2">Implementation Notes</h3>
              <div className="text-sm text-blue-300 space-y-2">
                <p><strong>GitHub Issues Addressed:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>#883: PWA Offline Status Banner & Service Worker Caching Layer</li>
                  <li>#918: Yield Vault Harvest Rewards History & Breakdown Modal</li>
                  <li>#894: Custom Price & Health Factor Browser Push Notification Engine</li>
                  <li>#855: Real-Time Order Book Delta Streaming Component</li>
                </ul>
                <p className="mt-3">
                  <strong>Next.js PWA Configuration:</strong> The next-pwa plugin is already configured in next.config.ts with 
                  proper caching strategies and offline fallbacks.
                </p>
                <p>
                  <strong>Testing:</strong> Use browser dev tools to simulate offline mode, test push notification permissions, 
                  and verify PWA installation prompts on mobile devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <HarvestHistoryModal
        isOpen={showHarvestModal}
        onClose={() => setShowHarvestModal(false)}
        vaultId="multi-asset-vault-1"
        vaultName="Multi-Asset Yield Vault"
      />

      <PushNotificationManager
        modal
        onClose={() => setShowNotificationModal(false)}
      />
    </div>
  );
}
