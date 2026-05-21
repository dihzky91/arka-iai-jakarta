/**
 * Layout untuk halaman verifikasi publik.
 * Force-reset CSS variables ke tema default (ocean/blue) agar halaman publik
 * tidak terpengaruh oleh preferensi warna user internal.
 */
export default function VerifikasiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="verifikasi-public"
      style={{
        // Reset ke default :root values — netral, tidak ikut tema user
        "--background": "hsl(210 40% 98%)",
        "--foreground": "hsl(222.2 47.4% 11.2%)",
        "--muted": "hsl(210 40% 96.1%)",
        "--muted-foreground": "hsl(215.4 16.3% 40%)",
        "--border": "hsl(214.3 31.8% 91.4%)",
        "--primary": "hsl(221.2 83.2% 53.3%)",
        "--primary-foreground": "hsl(210 40% 98%)",
        "--ring": "hsl(221.2 83.2% 53.3%)",
        "--card": "hsl(0 0% 100%)",
        "--card-foreground": "hsl(222.2 47.4% 11.2%)",
        "--secondary": "hsl(210 40% 96.1%)",
        "--secondary-foreground": "hsl(222.2 47.4% 11.2%)",
        "--destructive": "hsl(0 84.2% 60.2%)",
        "--destructive-foreground": "hsl(210 40% 98%)",
        "--input": "hsl(214.3 31.8% 91.4%)",
        "--popover": "hsl(0 0% 100%)",
        "--popover-foreground": "hsl(222.2 47.4% 11.2%)",
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
