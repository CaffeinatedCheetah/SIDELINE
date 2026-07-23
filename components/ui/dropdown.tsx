"use client";
import * as D from "@radix-ui/react-dropdown-menu";
export const Dropdown = D.Root;
export const DropdownTrigger = D.Trigger;
export function DropdownContent({ children }: { children: React.ReactNode }) {
  return (
    <D.Portal>
      <D.Content className="border-border-strong bg-surface-2 z-50 min-w-48 rounded-md border p-1 shadow-2xl">
        {children}
      </D.Content>
    </D.Portal>
  );
}
export function DropdownItem(props: D.DropdownMenuItemProps) {
  return (
    <D.Item
      {...props}
      className="focus:bg-surface-3 flex min-h-10 cursor-default items-center rounded-sm px-3 text-sm outline-none data-[disabled]:opacity-50"
    />
  );
}
