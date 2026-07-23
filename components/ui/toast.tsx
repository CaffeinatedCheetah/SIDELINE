"use client";
import * as T from "@radix-ui/react-toast";
export const ToastProvider = T.Provider;
export const ToastViewport = () => (
  <T.Viewport className="fixed right-4 bottom-20 z-[60] grid w-[min(24rem,calc(100%-2rem))] gap-2 md:bottom-4" />
);
export function Toast({
  open,
  onOpenChange,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
}) {
  return (
    <T.Root
      open={open}
      onOpenChange={onOpenChange}
      className="border-border-strong bg-surface-2 rounded-md border p-4 shadow-2xl"
    >
      <T.Title className="font-bold">{title}</T.Title>
      {description && (
        <T.Description className="text-text-secondary mt-1 text-sm">
          {description}
        </T.Description>
      )}
    </T.Root>
  );
}
