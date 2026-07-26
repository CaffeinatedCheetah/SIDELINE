"use client";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_LABELS: Record<string, string> = {
  takes: "Takes",
  predictions: "Predictions",
  debates: "Debates",
  communities: "Communities",
  about: "About",
};
export const PROFILE_TABS = Object.keys(TAB_LABELS);

export function ProfileTabs({
  handle,
  active,
  children,
}: {
  handle: string;
  active: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        // Mobile per the design doc keeps these URL-backed, so a refresh or
        // shared link lands on the same tab (also drives which tab's list
        // gets fetched server-side -- see app/users/[handle]/page.tsx).
        router.push(
          value === "takes"
            ? `/users/${handle}`
            : `/users/${handle}?tab=${value}`,
        );
      }}
    >
      <TabsList>
        {PROFILE_TABS.map((tab) => (
          <TabsTrigger value={tab} key={tab}>
            {TAB_LABELS[tab]}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={active}>{children}</TabsContent>
    </Tabs>
  );
}
