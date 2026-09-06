import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Gramelle",
  description: "Gramelle — PvP roulette on TON",
  applicationName: "Gramelle",
  icons: { icon: "/gram-badge.png", apple: "/gram-badge.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#06060a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col app-bg text-white">
        <div className="flex-1 flex flex-col w-full max-w-lg mx-auto relative">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
