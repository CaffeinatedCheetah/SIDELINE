import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "min-h-11 w-full rounded-sm border border-border-subtle bg-surface-2 px-3 text-text-primary placeholder:text-text-muted hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}
export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cn(control, "min-h-30 py-3", props.className)}
    />
  );
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}
export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" className="accent-brand size-5" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Radio({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="radio" className="accent-brand size-5" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const description = error
    ? `${htmlFor}-error`
    : help
      ? `${htmlFor}-help`
      : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm font-bold">
        {label}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<Record<string, string>>,
            {
              "aria-describedby": description,
              "aria-invalid": error ? "true" : undefined,
            },
          )
        : children}
      {help && !error && (
        <p id={`${htmlFor}-help`} className="text-text-secondary text-sm">
          {help}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
