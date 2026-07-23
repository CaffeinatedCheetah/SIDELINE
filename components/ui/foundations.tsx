import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border-subtle bg-surface-2 rounded-md border p-4 md:p-5",
        className,
      )}
      {...props}
    />
  );
}
export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "live" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-3 text-text-secondary",
    live: "bg-brand text-white",
    success: "bg-success text-black",
    warning: "bg-warning text-black",
    danger: "bg-danger text-black",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "size-8", md: "size-10", lg: "size-14" };
  const pixels = { sm: 32, md: 40, lg: 56 };
  return (
    <span
      className={cn(
        "bg-surface-3 inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold",
        sizes[size],
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={pixels[size]}
          height={pixels[size]}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("bg-surface-3 block animate-pulse rounded-sm", className)}
    />
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="grid place-items-center gap-3 py-12 text-center">
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-text-secondary max-w-md">{description}</p>
      {action}
    </Card>
  );
}
export function ErrorState({
  title = "Something went wrong",
  description,
  retry,
}: {
  title?: string;
  description: string;
  retry?: React.ReactNode;
}) {
  return (
    <Card role="alert" className="border-danger/50">
      <h3 className="text-danger font-bold">{title}</h3>
      <p className="text-text-secondary mt-2">{description}</p>
      {retry && <div className="mt-4">{retry}</div>}
    </Card>
  );
}
