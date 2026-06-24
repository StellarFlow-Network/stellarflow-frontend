"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";

/**
 * ConsumerSearchInput - Autonomous search component with isolated state
 * Manages its own input state locally to prevent triggering parent re-renders
 * Passes debounced search term to parent via callback
 */
export function ConsumerSearchInput({
  onSearchChange,
}: {
  onSearchChange: (term: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    // Parent handles debouncing via useDebounce hook
    onSearchChange(value);
  };

  return (
    <div className="relative w-full md:w-96">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        size={18}
      />
      <input
        type="text"
        placeholder="Filter consumers by contract or title..."
        className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        value={inputValue}
        onChange={handleChange}
      />
    </div>
  );
}
