"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;
export function TabsList({ children }: { children: React.ReactNode }) {
  return (
    <TabsPrimitive.List
      className="border-border-subtle flex gap-1 overflow-x-auto border-b"
      aria-label="Sections"
    >
      {children}
    </TabsPrimitive.List>
  );
}
export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="text-text-secondary data-[state=active]:border-brand data-[state=active]:text-text-primary min-h-11 border-b-2 border-transparent px-4 text-sm font-bold whitespace-nowrap"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}
