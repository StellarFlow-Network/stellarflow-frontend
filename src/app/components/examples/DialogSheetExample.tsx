"use client";

import React, { useState } from "react";
import { Settings, FileText, Bell } from "lucide-react";
import OptimizedDialog from "../OptimizedDialog";
import OptimizedSheet from "../OptimizedSheet";

/**
 * DialogSheetExample Component
 * 
 * Demonstrates proper usage of OptimizedDialog and OptimizedSheet components
 * with conditional rendering for optimal DOM efficiency.
 * 
 * This example shows:
 * - Multiple dialogs/sheets can be controlled independently
 * - Elements are completely removed from DOM when closed
 * - Smooth animations on open/close
 * - Proper state management
 */

export function DialogSheetExample() {
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [isDocsPanelOpen, setIsDocsPanelOpen] = useState(false);

  return (
    <div className="bg-[#0a0a0a] min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Optimized Dialog & Sheet Examples
          </h1>
          <p className="text-gray-400">
            Click buttons below to see conditional rendering in action.
            Open DevTools Elements tab to verify components are removed from DOM when closed.
          </p>
        </div>

        {/* Example buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Dialog example */}
          <button
            onClick={() => setIsSettingsDialogOpen(true)}
            className="flex flex-col items-center gap-3 p-6 bg-[#161b22] border border-gray-800 rounded-xl hover:border-blue-500 transition-colors"
          >
            <Settings className="w-8 h-8 text-blue-400" />
            <div className="text-center">
              <h3 className="font-semibold text-white">Settings Dialog</h3>
              <p className="text-xs text-gray-500 mt-1">
                Centered modal dialog
              </p>
            </div>
          </button>

          {/* Right panel example */}
          <button
            onClick={() => setIsNotificationsPanelOpen(true)}
            className="flex flex-col items-center gap-3 p-6 bg-[#161b22] border border-gray-800 rounded-xl hover:border-purple-500 transition-colors"
          >
            <Bell className="w-8 h-8 text-purple-400" />
            <div className="text-center">
              <h3 className="font-semibold text-white">Notifications Panel</h3>
              <p className="text-xs text-gray-500 mt-1">
                Slide from right
              </p>
            </div>
          </button>

          {/* Left panel example */}
          <button
            onClick={() => setIsDocsPanelOpen(true)}
            className="flex flex-col items-center gap-3 p-6 bg-[#161b22] border border-gray-800 rounded-xl hover:border-green-500 transition-colors"
          >
            <FileText className="w-8 h-8 text-green-400" />
            <div className="text-center">
              <h3 className="font-semibold text-white">Documentation Panel</h3>
              <p className="text-xs text-gray-500 mt-1">
                Slide from left
              </p>
            </div>
          </button>
        </div>

        {/* Performance info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
          <h3 className="font-semibold text-blue-400 mb-2">
            🚀 Performance Benefits
          </h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• Components are <strong>completely removed</strong> from DOM when closed</li>
            <li>• No hidden elements consuming memory or processing power</li>
            <li>• Event listeners automatically cleaned up on unmount</li>
            <li>• Faster React reconciliation with fewer DOM nodes</li>
            <li>• Smooth animations with AnimatePresence</li>
          </ul>
        </div>
      </div>

      {/* Dialog - Only in DOM when isSettingsDialogOpen is true */}
      <OptimizedDialog
        isOpen={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
        title="Admin Settings"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Application Name
            </label>
            <input
              type="text"
              defaultValue="StellarFlow Oracle"
              className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Endpoint
            </label>
            <input
              type="text"
              defaultValue="https://api.stellarflow.io"
              className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enable-debug"
              className="w-4 h-4 rounded border-gray-700"
            />
            <label htmlFor="enable-debug" className="text-sm text-gray-300">
              Enable debug mode
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsSettingsDialogOpen(false)}
              className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                alert("Settings saved!");
                setIsSettingsDialogOpen(false);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </OptimizedDialog>

      {/* Notifications Panel - Only in DOM when isNotificationsPanelOpen is true */}
      <OptimizedSheet
        isOpen={isNotificationsPanelOpen}
        onClose={() => setIsNotificationsPanelOpen(false)}
        title="Notifications"
        position="right"
        size="md"
      >
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-[#161b22] border border-gray-800 rounded-lg p-4 hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-sm">
                    System Update {i}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    New oracle data available for processing
                  </p>
                  <p className="text-xs text-gray-500 mt-2">2 minutes ago</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </OptimizedSheet>

      {/* Documentation Panel - Only in DOM when isDocsPanelOpen is true */}
      <OptimizedSheet
        isOpen={isDocsPanelOpen}
        onClose={() => setIsDocsPanelOpen(false)}
        title="Documentation"
        position="left"
        size="lg"
      >
        <div className="prose prose-invert max-w-none">
          <h3 className="text-xl font-bold text-white mb-4">Quick Start Guide</h3>
          <p className="text-gray-300 mb-4">
            Welcome to StellarFlow Oracle dashboard. This documentation will help
            you get started with managing your oracle network.
          </p>
          
          <h4 className="text-lg font-semibold text-white mb-2 mt-6">
            Key Features
          </h4>
          <ul className="space-y-2 text-gray-300">
            <li>Real-time price feed monitoring</li>
            <li>Network health visualization</li>
            <li>Relayer status tracking</li>
            <li>Governance proposals management</li>
          </ul>

          <h4 className="text-lg font-semibold text-white mb-2 mt-6">
            Best Practices
          </h4>
          <ul className="space-y-2 text-gray-300">
            <li>Monitor network health daily</li>
            <li>Review relayer performance weekly</li>
            <li>Participate in governance decisions</li>
            <li>Keep your wallet connected</li>
          </ul>

          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mt-6">
            <p className="text-green-400 text-sm">
              💡 <strong>Tip:</strong> Use the floating sidebar for quick navigation
              between different sections of the dashboard.
            </p>
          </div>
        </div>
      </OptimizedSheet>
    </div>
  );
}

export default DialogSheetExample;
