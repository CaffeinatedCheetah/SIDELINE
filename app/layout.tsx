import type { Metadata } from "next";
import { auth } from "@/auth";
import { Footer } from "@/components/navigation/footer";
import { Navbar } from "@/components/navigation/navbar";
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
  const [preferences, unread] = session?.user?.id
    ? await Promise.all([
        db.userPreference.findUnique({
          where: { userId: session.user.id },
          select: { theme: true, reducedMotion: true, reducedData: true },
        }),
        db.notification.count({
          where: { recipientId: session.user.id, readAt: null },
        }),
      ])
    : [null, 0];
  const theme = preferences?.theme ?? "dark";
  return (
    <html
      lang="en"
      className={`h-full antialiased theme-${theme}${preferences?.reducedMotion ? "reduce-motion" : ""}`}
      data-reduced-data={preferences?.reducedData ? "true" : "false"}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Navbar authenticated={Boolean(session?.user?.id)} unread={unread} />
        <main id="main-content" className="flex flex-1 flex-col pb-16 lg:pb-0">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
