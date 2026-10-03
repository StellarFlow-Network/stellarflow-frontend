"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  DashboardWidget,
  DashboardLayout,
  DEFAULT_WIDGETS,
  getStoredLayout,
  saveLayout,
  resetToDefaultLayout,
} from "./DashboardWidgetTypes";
import { useToast } from "@/components/ui/ToastQueue";

interface DraggableWidgetProps {
  widget: DashboardWidget;
  index: number;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragging: boolean;
  draggedId: string | null;
}

function DraggableWidget({
  widget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  draggedId,
}: DraggableWidgetProps) {
  const isDragged = draggedId === widget.id;
  const opacity = isDragging && !isDragged ? 0.4 : 1;
  const transform = isDragged ? "rotate(3deg) scale(1.02)" : "none";

  return (
    <div
      key={widget.id}
      draggable
      onDragStart={(e) => onDragStart(e as React.DragEvent<HTMLElement>, widget.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e as React.DragEvent<HTMLElement>, widget.id)}
      onDragEnd={onDragEnd}
      className="group relative bg-[#161b22] border border-gray-800 rounded-xl p-4 cursor-move transition-all duration-200"
      style={{ opacity, transform }}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Icon id={ICON_IDS.rotateCcw} size={16} className="text-gray-500" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              widget.category === "analytics" && "bg-blue-500/20 text-blue-400"
            } ${widget.category === "trading" && "bg-green-500/20 text-green-400"}
             ${widget.category === "network" && "bg-purple-500/20 text-purple-400"}
             ${widget.category === "utility" && "bg-orange-500/20 text-orange-400"}`}
          >
            <Icon
              id={
                widget.category === "analytics"
                  ? ICON_IDS.lineChart
                  : widget.category === "trading"
                  ? ICON_IDS.activity
                  : widget.category === "network"
                  ? ICON_IDS.globe
                  : ICON_IDS.settings
              }
              size={16}
            />
          </div>
          <div>
            <p className="font-medium text-gray-100">{widget.title}</p>
            <p className="text-xs text-gray-500 capitalize">{widget.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${widget.visible ? "bg-emerald-400" : "bg-gray-600"}`}
          />
          <span className="text-xs text-gray-500">
            {widget.visible ? "Visible" : "Hidden"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashboardWidgetCustomizer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { addToast, updateToast } = useToast();
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    getStoredLayout() || { widgets: DEFAULT_WIDGETS, order: DEFAULT_WIDGETS.map((w) => w.id) }
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Layout is initialized from localStorage in useState initializer above.
  // No need for useEffect to reload on isOpen change.

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (sourceId && sourceId !== targetId) {
        setLayout((prev) => {
          const newOrder = [...prev.order];
          const fromIndex = newOrder.indexOf(sourceId);
          const toIndex = newOrder.indexOf(targetId);
          if (fromIndex !== -1 && toIndex !== -1) {
            newOrder.splice(fromIndex, 1);
            newOrder.splice(toIndex, 0, sourceId);
            return { ...prev, order: newOrder };
          }
          return prev;
        });
      }
      setDraggedId(null);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      ),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    const toastId = addToast({
      title: "Saving layout…",
      description: "Persisting your dashboard configuration",
      status: "processing",
    });

    try {
      saveLayout(layout);
      updateToast(toastId, {
        title: "Layout saved",
        description: "Your dashboard layout has been updated",
        status: "confirmed",
      });
      onClose();
    } catch {
      updateToast(toastId, {
        title: "Save failed",
        description: "Could not save layout. Please try again.",
        status: "failed",
      });
    }
  }, [layout, addToast, updateToast, onClose]);

  const handleReset = useCallback(async () => {
    const toastId = addToast({
      title: "Resetting layout…",
      description: "Restoring default dashboard configuration",
      status: "processing",
    });

    try {
      const defaultLayout = resetToDefaultLayout();
      saveLayout(defaultLayout);
      setLayout(defaultLayout);
      updateToast(toastId, {
        title: "Layout reset",
        description: "Dashboard restored to default layout",
        status: "confirmed",
      });
    } catch {
      updateToast(toastId, {
        title: "Reset failed",
        description: "Could not reset layout. Please try again.",
        status: "failed",
      });
    }
  }, [addToast, updateToast]);

  const orderedWidgets = layout.order
    .map((id) => layout.widgets.find((w) => w.id === id))
    .filter((w): w is DashboardWidget => w !== undefined);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-3xl max-h-[85vh] bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Icon id={ICON_IDS.layoutDashboard} size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Customize Dashboard</h2>
                <p className="text-xs text-gray-500">Drag to reorder, toggle visibility</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <Icon id={ICON_IDS.xCircle} size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-3" role="list" aria-label="Dashboard widgets">
              {orderedWidgets.map((widget, index) => (
                <DraggableWidget
                  key={widget.id}
                  widget={widget}
                  index={index}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedId !== null}
                  draggedId={draggedId}
                />
              ))}
            </div>

            <div className="border-t border-gray-800 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Widget Visibility</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {layout.widgets.map((widget) => (
                  <label
                    key={widget.id}
                    className="flex items-center justify-between p-3 bg-[#0d1117] border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center ${
                          widget.category === "analytics" && "bg-blue-500/20"
                        } ${widget.category === "trading" && "bg-green-500/20"}
                         ${widget.category === "network" && "bg-purple-500/20"}
                         ${widget.category === "utility" && "bg-orange-500/20"}`}
                      >
                        <Icon
                          id={
                            widget.category === "analytics"
                              ? ICON_IDS.lineChart
                              : widget.category === "trading"
                              ? ICON_IDS.activity
                              : widget.category === "network"
                              ? ICON_IDS.globe
                              : ICON_IDS.settings
                          }
                          size={12}
                          className={
                            widget.category === "analytics"
                              ? "text-blue-400"
                              : widget.category === "trading"
                              ? "text-green-400"
                              : widget.category === "network"
                              ? "text-purple-400"
                              : "text-orange-400"
                          }
                        />
                      </div>
                      <span className="text-sm text-gray-100">{widget.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleWidgetVisibility(widget.id)}
                      role="switch"
                      aria-checked={widget.visible}
                      aria-label={widget.visible ? `Hide ${widget.title}` : `Show ${widget.title}`}
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        widget.visible ? "bg-blue-600" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          widget.visible ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-800 p-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
            >
              <Icon id={ICON_IDS.rotateCcw} size={16} className="inline-block mr-1" />
              Reset to Default
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-700 rounded-lg text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Icon id={ICON_IDS.save} size={16} />
                Save Layout
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}