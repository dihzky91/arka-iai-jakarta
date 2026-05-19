import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { APP_BRAND_DESCRIPTION } from "@/lib/branding";
import { COLOR_THEME_IDS } from "@/lib/color-themes";
import { getSystemSettings } from "@/server/actions/systemSettings";
import "@/styles/globals.css";

const inter = localFont({
  src: [
    { path: "../assets/fonts/inter-latin-400.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/inter-latin-500.ttf", weight: "500", style: "normal" },
    { path: "../assets/fonts/inter-latin-600.ttf", weight: "600", style: "normal" },
    { path: "../assets/fonts/inter-latin-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const outfit = localFont({
  src: [
    { path: "../assets/fonts/outfit-latin-400.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/outfit-latin-500.ttf", weight: "500", style: "normal" },
    { path: "../assets/fonts/outfit-latin-600.ttf", weight: "600", style: "normal" },
    { path: "../assets/fonts/outfit-latin-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-outfit",
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
      <body className={`${inter.variable} ${outfit.variable} font-sans min-h-screen bg-background text-foreground antialiased transition-colors duration-200`}>
        <ThemeProvider
          attribute="data-theme"
          themes={COLOR_THEME_IDS}
          defaultTheme="ocean"
          enableSystem={false}
          storageKey="arka-color-theme"
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
