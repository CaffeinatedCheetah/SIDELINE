import type { Metadata } from "next";
import { auth } from "@/auth";
import { Footer } from "@/components/navigation/footer";
import { Navbar } from "@/components/navigation/navbar";
import { RailProvider } from "@/components/navigation/rail-context";
import { ShellGate } from "@/components/navigation/shell-gate";
import { db } from "@/lib/db/client";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: { default: "FanTakes", template: "%s | FanTakes" },
  description: "Live scores, real conversations, and fan identity.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const userId = session?.user?.id;
  const [preferences, unread] = userId
    ? await Promise.all([
        db.userPreference.findUnique({
          where: { userId },
          select: { theme: true, reducedMotion: true, reducedData: true },
        }),
        db.notification.count({
          where: { recipientId: userId, readAt: null },
        }),
      ])
    : [null, 0];
  const theme = preferences?.theme ?? "dark";
  return (
    <html
      lang="en"
      className={`h-full antialiased theme-${theme}${preferences?.reducedMotion ? " reduce-motion" : ""}`}
      data-scroll-behavior="smooth"
      data-reduced-data={preferences?.reducedData ? "true" : "false"}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <RailProvider>
          <Navbar authenticated={Boolean(userId)} unread={unread} />
          <main
            id="main-content"
            className="flex flex-1 flex-col pb-16 lg:pb-0"
          >
            <ShellGate>{children}</ShellGate>
          </main>
          <Footer />
        </RailProvider>
      </body>
    </html>
  );
}
