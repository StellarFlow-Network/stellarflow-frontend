"use client";

import React, { useEffect, useMemo, useRef } from "react";

/**
 * A single field error, shaped like React Hook Form's `FieldError`.
 *
 * The component accepts React Hook Form's `formState.errors` object as-is
 * (nested objects and arrays included) without importing the library, so it
 * also works with hand-rolled validation that produces the same shape.
 */
export interface FieldErrorLike {
  message?: unknown;
  type?: unknown;
  ref?: unknown;
}

export type FieldErrorsLike = {
  [field: string]: FieldErrorLike | FieldErrorsLike | FieldErrorsLike[] | undefined;
};

export interface SummaryError {
  /** Dotted field path, the same form React Hook Form uses (`items.0.amount`). */
  name: string;
  message: string;
}

/**
 * Flattens a React Hook Form style errors object into an ordered list of
 * `{ name, message }` pairs, in the order the fields appear in the object.
 * Entries without a string message are skipped: there is nothing useful to
 * show for them.
 */
export function flattenFieldErrors(errors: FieldErrorsLike | undefined, prefix = ""): SummaryError[] {
  if (!errors) return [];
  const out: SummaryError[] = [];

  for (const [key, value] of Object.entries(errors)) {
    if (value == null) continue;
    const name = prefix ? `${prefix}.${key}` : key;

    if (isFieldError(value)) {
      if (typeof value.message === "string" && value.message.trim() !== "") {
        out.push({ name, message: value.message });
      }
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        out.push(...flattenFieldErrors(item, `${name}.${index}`));
      });
      continue;
    }

    if (typeof value === "object") {
      out.push(...flattenFieldErrors(value as FieldErrorsLike, name));
    }
  }

  return out;
}

function isFieldError(value: unknown): value is FieldErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("message" in value || "type" in value)
  );
}

/** Default id convention for inputs: `field-` plus the path with dots as dashes. */
export function defaultFieldId(name: string): string {
  return `field-${name.replace(/\./g, "-")}`;
}

export interface FormErrorSummaryProps {
  /** `formState.errors` from React Hook Form, or any object of the same shape. */
  errors: FieldErrorsLike | undefined;
  /** Human-readable labels per field path, used as the link text prefix. */
  labels?: Record<string, string>;
  /**
   * Moves focus to a field. Pass React Hook Form's `setFocus` here. When it is
   * omitted the summary looks the input up by id (see `getFieldId`) and then
   * by `name` attribute.
   */
  setFocus?: (name: string) => void;
  /** Maps a field path to the id of its input. Defaults to `defaultFieldId`. */
  getFieldId?: (name: string) => string;
  /** Heading text. */
  title?: string;
  /**
   * Bump this (for example with `formState.submitCount`) to move focus to the
   * summary after each failed submit, so keyboard and screen reader users
   * land on the list of problems.
   */
  focusKey?: number;
  className?: string;
}

/**
 * Accessible summary of every active validation error in a form (#1175).
 *
 * Renders nothing when the form is valid. When there are errors it shows a
 * banner with one link per error; following a link moves keyboard focus to
 * the invalid input. The banner is an ARIA live region, so the errors are
 * announced when they appear.
 */
export function FormErrorSummary({
  errors,
  labels,
  setFocus,
  getFieldId = defaultFieldId,
  title = "There is a problem with this form",
  focusKey,
  className = "",
}: FormErrorSummaryProps) {
  const items = useMemo(() => flattenFieldErrors(errors), [errors]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusKey === undefined || items.length === 0) return;
    containerRef.current?.focus();
    // Only re-run when the caller signals a new submit attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const focusField = (name: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (setFocus) {
      setFocus(name);
      return;
    }
    const byId = document.getElementById(getFieldId(name));
    const target =
      byId ?? document.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
    target?.focus();
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby={items.length > 0 ? "form-error-summary-title" : undefined}
      className={
        items.length > 0
          ? `rounded-xl border border-red-500/40 bg-red-950/60 p-4 text-sm text-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 ${className}`
          : undefined
      }
      data-testid="form-error-summary"
    >
      {items.length > 0 ? (
        <>
          <h2 id="form-error-summary-title" className="mb-2 font-semibold text-red-50">
            {title}
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            {items.map(({ name, message }) => {
              const label = labels?.[name];
              return (
                <li key={name}>
                  <a
                    href={`#${getFieldId(name)}`}
                    onClick={focusField(name)}
                    className="underline underline-offset-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-300 rounded-sm"
                  >
                    {label ? `${label}: ${message}` : message}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export default FormErrorSummary;
