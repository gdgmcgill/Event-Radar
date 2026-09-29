"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

/** Shared, accessible pieces of the public intake forms (M3 P1-09). */

export const inputStyle =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm aria-[invalid=true]:border-destructive";

export const SENT_MESSAGE =
  "Thanks — a person reviews every submission before anything is published.";
export const RATE_MESSAGE = "Too many submissions. Try again later.";
export const NETWORK_MESSAGE = "Couldn't send. Your text is still here.";

export type SendOutcome =
  | { kind: "sent" }
  | { kind: "rate" }
  | { kind: "missing" }
  | { kind: "rejected"; message: string; field?: string };

/** POSTs a typed intake body. A network failure rejects (the caller keeps the
 * user's text); every HTTP answer maps to one outcome. Nothing from the
 * response is shown except a server validation message. */
export async function sendIntake<T>(path: string, body: T): Promise<SendOutcome> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 202) return { kind: "sent" };
  if (response.status === 429) return { kind: "rate" };
  if (response.status === 404) return { kind: "missing" };
  const data = await response.json().catch(() => null);
  return {
    kind: "rejected",
    message: typeof data?.error === "string" ? data.error : "Check the form and try again.",
    field: typeof data?.field === "string" ? data.field : undefined,
  };
}

/** Trimmed value or undefined, so JSON omits empty optional fields. */
export function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  type?: string;
  multiline?: boolean;
  rows?: number;
  autoComplete?: string;
};

export function Field({ id, label, value, onChange, error, hint, required, maxLength, type = "text", multiline, rows = 4, autoComplete }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    name: id,
    value,
    required,
    maxLength,
    autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: inputStyle,
  };
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...shared} type={type} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  error?: string;
  required?: boolean;
  placeholder?: string;
};

export function SelectField({ id, label, value, onChange, options, error, required, placeholder }: SelectFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={inputStyle}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Visually hidden and hidden from assistive technology; never focusable. A
 * bot that fills every input fills this one, and the server then accepts the
 * request without storing anything. */
export function Honeypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = `website-${useId()}`;
  return (
    <div aria-hidden="true" className="sr-only">
      <label htmlFor={id}>Website</label>
      <input id={id} name="website" type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

/** Focus moves here once it renders, so keyboard and screen-reader users land
 * on the outcome after the form they were in disappears. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

export function FormStatus({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {children}
    </p>
  );
}

export function SentNotice() {
  const ref = useFocusOnMount<HTMLDivElement>();
  return (
    <div ref={ref} role="status" tabIndex={-1} className="rounded-xl border border-border bg-card p-8 outline-none">
      <p className="text-lg font-semibold">{SENT_MESSAGE}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing is posted automatically. If we need more detail we will use the contact you gave, and only for this submission.
      </p>
    </div>
  );
}

/** Required-field and format checks mirrored from the contracts, so a person
 * sees errors next to the fields before anything is sent. The server remains
 * the authority. */
export function requireFields(values: Record<string, string>, required: readonly string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of required) if (!values[key]?.trim()) errors[key] = "Required";
  return errors;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}
