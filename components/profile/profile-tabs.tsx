"use client";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROFILE_TABS, TAB_LABELS } from "@/lib/profile/tabs";

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
          value === "activity" ? `/u/${handle}` : `/u/${handle}?tab=${value}`,
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
