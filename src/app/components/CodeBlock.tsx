"use client";

import dynamic from "next/dynamic";
import React from "react";

const RemoteSyntax = dynamic(() => import("./RemoteSyntax"), {
  ssr: false,
  loading: () => (
    <pre className="whitespace-pre text-sm font-mono text-gray-300">Loading code…</pre>
  ),
});

export default function CodeBlock({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  return <RemoteSyntax code={code} language={language} />;
}
