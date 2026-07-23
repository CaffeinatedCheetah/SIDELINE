"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
export function Modal({
  trigger,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content className="border-border-strong bg-surface-2 fixed inset-x-4 top-1/2 z-50 max-h-[90dvh] -translate-y-1/2 overflow-auto rounded-lg border p-5 shadow-2xl sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2">
          <Dialog.Title className="text-2xl font-bold">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="text-text-secondary mt-2">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-5">{children}</div>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close dialog"
              className="absolute top-2 right-2"
            >
              <X aria-hidden className="size-5" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmationDialog({
  trigger,
  title,
  description,
  onConfirm,
  danger = false,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Modal trigger={trigger} title={title} description={description}>
      <div className="flex justify-end gap-3">
        <Dialog.Close asChild>
          <Button variant="secondary">Cancel</Button>
        </Dialog.Close>
        <Dialog.Close asChild>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            Confirm
          </Button>
        </Dialog.Close>
      </div>
    </Modal>
  );
}
export const Drawer = Modal;
