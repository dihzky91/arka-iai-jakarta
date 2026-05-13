import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { APP_BRAND_DESCRIPTION } from "@/lib/branding";
import { getSystemSettings } from "@/server/actions/systemSettings";
import "@/styles/globals.css";

const inter = localFont({
  src: "../assets/fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const outfit = localFont({
  src: "../assets/fonts/outfit-latin-variable.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  return {
    title: settings.namaSistem,
    description: APP_BRAND_DESCRIPTION,
    ...(settings.faviconUrl && {
      icons: { icon: settings.faviconUrl },
    }),
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} font-sans min-h-screen bg-background text-foreground antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
