"use client";

/**
 * PasskeyDeviceList
 *
 * Renders the list of registered passkey / credential devices from the
 * Zustand store.  Each row exposes:
 *   - Device name with an editable rename affordance
 *   - Registration date
 *   - Platform icon hinting Touch ID / Windows Hello / security key
 *   - Delete button with inline confirmation
 *
 * Designed to be embedded in a Settings page or security dashboard.
 */

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Fingerprint,
  Key,
  Laptop,
  Smartphone,
  Shield,
  Trash2,
  Pencil,
  Check,
  X,
  Plus,
} from "lucide-react";
import { usePasskeys, type PasskeyDevice } from "@/hooks/usePasskeys";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PasskeyDeviceListProps {
  /** Optional: intercept the "Add passkey" button click to open your modal. */
  onAddPasskey?: () => void;
  /** Optional: called after a device is deleted. */
  onDeviceDeleted?: (credentialId: string) => void;
  /** Show heading + add-button. Default true. */
  showHeader?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Platform = "touchid" | "windows" | "android" | "key" | "password" | "generic";

function inferPlatform(device: PasskeyDevice): Platform {
  const hint = device.aaguidHint?.toLowerCase() ?? "";
  const name = device.name.toLowerCase();
  if (hint === "password") return "password";
  if (
    hint.includes("touch") ||
    hint.includes("face") ||
    name.includes("mac") ||
    name.includes("iphone") ||
    name.includes("ipad") ||
    name.includes("touch")
  )
    return "touchid";
  if (
    name.includes("windows") ||
    name.includes("hello") ||
    name.includes("surface")
  )
    return "windows";
  if (
    name.includes("android") ||
    name.includes("pixel") ||
    name.includes("samsung") ||
    name.includes("galaxy")
  )
    return "android";
  if (hint === "cross-platform") return "key";
  return "generic";
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const cls = "h-5 w-5";
  if (platform === "touchid")
    return <Fingerprint className={`${cls} text-blue-400`} aria-hidden="true" />;
  if (platform === "windows")
    return <Laptop className={`${cls} text-purple-400`} aria-hidden="true" />;
  if (platform === "android")
    return <Smartphone className={`${cls} text-green-400`} aria-hidden="true" />;
  if (platform === "key")
    return <Key className={`${cls} text-amber-400`} aria-hidden="true" />;
  if (platform === "password")
    return <Shield className={`${cls} text-gray-400`} aria-hidden="true" />;
  return <Fingerprint className={`${cls} text-gray-400`} aria-hidden="true" />;
}

function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    touchid: "Touch ID / Face ID",
    windows: "Windows Hello",
    android: "Android Biometric",
    key: "Security Key",
    password: "Password Fallback",
    generic: "Passkey",
  };
  return labels[platform];
}

// ---------------------------------------------------------------------------
// Single device row
// ---------------------------------------------------------------------------

interface DeviceRowProps {
  device: PasskeyDevice;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function DeviceRow({ device, onDelete, onRename }: DeviceRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(device.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const platform = inferPlatform(device);

  const handleStartEdit = useCallback(() => {
    setDraftName(device.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [device.name]);

  const handleSaveEdit = useCallback(() => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== device.name) {
      onRename(device.credentialId, trimmed);
    }
    setEditing(false);
  }, [draftName, device, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSaveEdit();
      if (e.key === "Escape") {
        setDraftName(device.name);
        setEditing(false);
      }
    },
    [handleSaveEdit, device.name],
  );

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 rounded-xl bg-gray-800/60 border border-white/8 p-4"
    >
      {/* Platform icon */}
      <div className="mt-0.5 shrink-0">
        <PlatformIcon platform={platform} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveEdit}
              maxLength={48}
              className="flex-1 min-w-0 rounded-md bg-gray-700 border border-white/10 text-white text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Edit device name"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); handleSaveEdit(); }}
              className="text-green-400 hover:text-green-300 transition"
              aria-label="Save name"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setDraftName(device.name);
                setEditing(false);
              }}
              className="text-gray-400 hover:text-gray-200 transition"
              aria-label="Cancel rename"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group">
            <span className="text-sm font-medium text-white truncate">
              {device.name}
            </span>
            <button
              onClick={handleStartEdit}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-500 hover:text-gray-300 transition"
              aria-label={`Rename ${device.name}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{platformLabel(platform)}</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-500">
            Added {formatDate(device.registeredAt)}
          </span>
        </div>
      </div>

      {/* Delete */}
      <div className="shrink-0 mt-0.5">
        <AnimatePresence mode="wait">
          {confirmDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1"
            >
              <span className="text-xs text-red-400 mr-1">Remove?</span>
              <button
                onClick={() => {
                  onDelete(device.credentialId);
                }}
                className="text-red-400 hover:text-red-300 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded"
                aria-label="Confirm removal"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-gray-400 hover:text-gray-200 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500 rounded"
                aria-label="Cancel removal"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="delete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => setConfirmDelete(true)}
              className="text-gray-500 hover:text-red-400 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded"
              aria-label={`Remove ${device.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PasskeyDeviceList({
  onAddPasskey,
  onDeviceDeleted,
  showHeader = true,
  className = "",
}: PasskeyDeviceListProps) {
  const { devices, removeDevice, renameDevice } = usePasskeys();

  const handleDelete = useCallback(
    (credentialId: string) => {
      removeDevice(credentialId);
      onDeviceDeleted?.(credentialId);
    },
    [removeDevice, onDeviceDeleted],
  );

  return (
    <section
      className={`w-full ${className}`}
      aria-label="Registered passkey devices"
    >
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Passkeys &amp; Security Keys
          </h3>
          {onAddPasskey && (
            <button
              onClick={onAddPasskey}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              aria-label="Register a new passkey"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add passkey
            </button>
          )}
        </div>
      )}

      {devices.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3 py-8 rounded-xl border border-dashed border-white/10 text-center"
        >
          <Key className="h-8 w-8 text-gray-600" aria-hidden="true" />
          <p className="text-sm text-gray-500">No passkeys registered yet.</p>
          {onAddPasskey && (
            <button
              onClick={onAddPasskey}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Register your first passkey
            </button>
          )}
        </motion.div>
      ) : (
        <motion.ul layout className="flex flex-col gap-2" role="list">
          <AnimatePresence initial={false}>
            {devices.map((device) => (
              <DeviceRow
                key={device.credentialId}
                device={device}
                onDelete={handleDelete}
                onRename={renameDevice}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}
