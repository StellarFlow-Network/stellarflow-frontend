"use client";

import React, { useEffect, useState, useRef } from "react";
import { useToast } from "@/components/ui/ToastQueue";

export interface QuoteCountdownTimerProps {
  /** The ISO timestamp when the quote was received */
  anchorTimestamp?: string;
  /** Duration in seconds the quote is valid for */
  validityWindowSeconds?: number;
  /** Callback triggered when the countdown reaches zero */
  onRefresh: () => void;
  className?: string;
}

export default function QuoteCountdownTimer({
  anchorTimestamp,
  validityWindowSeconds = 60,
  onRefresh,
  className = "",
}: QuoteCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(validityWindowSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const { addToast } = useToast();
  
  // Track if we already triggered refresh for the current anchor to prevent loops
  const hasRefreshedRef = useRef(false);
  
  // Compute remaining time
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Reset hasRefreshed when anchor changes
    hasRefreshedRef.current = false;
    
    // Use an internal anchor if none is provided
    const internalAnchor = Date.now();
    
    const calculateTimeLeft = () => {
      let anchorMs = internalAnchor;
      if (anchorTimestamp) {
        anchorMs = new Date(anchorTimestamp).getTime();
        if (Number.isNaN(anchorMs)) {
          anchorMs = internalAnchor;
        }
      }
      
      const elapsed = (Date.now() - anchorMs) / 1000;
      return Math.max(0, validityWindowSeconds - elapsed);
    };
    
    // Initial calculate
    setTimeLeft(calculateTimeLeft());
    
    const tick = () => {
      setTimeLeft((prev) => {
        const newTimeLeft = calculateTimeLeft();
        
        if (newTimeLeft <= 0 && !hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          
          // Trigger refresh
          onRefresh();
          
          // Show toast
          addToast({
            title: "Quote Expired",
            description: "Automatically fetching a new firm quote...",
            status: "processing"
          });
          
          return 0;
        }
        
        return newTimeLeft;
      });
    };
    
    intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [anchorTimestamp, validityWindowSeconds, onRefresh, addToast]);

  // Handle page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.hidden);
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Determine color based on time left
  // Green -> Yellow (<= 15s) -> Red (<= 5s)
  let ringColor = "text-emerald-500";
  if (timeLeft <= 5) {
    ringColor = "text-rose-500";
  } else if (timeLeft <= 15) {
    ringColor = "text-amber-400";
  }

  // Calculate SVG stroke dashoffset
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  // Use a percentage. Max percentage is 100.
  const percentage = (timeLeft / validityWindowSeconds) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center w-12 h-12 ${className}`}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-gray-700/30"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isPaused ? 0 : strokeDashoffset}
          className={`${ringColor} ${isPaused ? '' : 'transition-all duration-1000 ease-linear'}`}
        />
      </svg>
      <div className="absolute flex items-center justify-center inset-0">
        <span className={`text-xs font-mono font-medium ${ringColor}`}>
          {Math.ceil(timeLeft)}
        </span>
      </div>
    </div>
  );
}
