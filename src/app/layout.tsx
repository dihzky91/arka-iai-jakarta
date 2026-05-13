import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { APP_BRAND_DESCRIPTION } from "@/lib/branding";
import { getSystemSettings } from "@/server/actions/systemSettings";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

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
