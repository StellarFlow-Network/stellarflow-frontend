"use client";

import React, { useEffect, useState } from "react";

export default function RemoteSyntax({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  const [Highlighter, setHighlighter] = useState<{
    Component: any;
    style: any;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    // Dynamically import the heavy highlighting engine at runtime.
    (async () => {
      try {
        // Try to load react-syntax-highlighter prism build and a dark theme.
        const [{ default: PrismLight }, { default: vsDark }] = await Promise.all([
          import("react-syntax-highlighter/dist/esm/prism-light"),
          import("react-syntax-highlighter/dist/esm/styles/prism/vs-dark"),
        ]);

        if (!mounted) return;

        setHighlighter({ Component: PrismLight, style: vsDark });
      } catch (err) {
        // If the heavy lib isn't available or fails to load, silently
        // fallback to a plain `<pre>`; this keeps the main bundle lean.
        // eslint-disable-next-line no-console
        console.debug("Remote syntax engine failed to load:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!Highlighter) {
    return (
      <pre className="whitespace-pre text-sm font-mono text-gray-300">{code}</pre>
    );
  }

  const { Component, style } = Highlighter;
  return (
    // `Component` is loaded at runtime; render it with provided props.
    <Component language={language} style={style} showLineNumbers={false}>
      {code}
    </Component>
  );
}
