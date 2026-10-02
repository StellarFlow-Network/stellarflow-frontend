import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-[#99DC1B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <span className="text-zinc-700">|</span>
          <span className="text-sm font-semibold text-zinc-300">Developer Tools</span>
        </div>
      </nav>
      {children}
    </div>
  );
}
