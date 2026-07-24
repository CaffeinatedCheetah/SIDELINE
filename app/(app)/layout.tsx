// Shell is now applied site-wide by the root layout's ShellGate,
// so this route-group layout no longer needs to wrap children itself.
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
