import { AppShell } from "@/components/navigation/app-shell";
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
