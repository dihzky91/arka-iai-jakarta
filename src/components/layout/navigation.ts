import {
  Award,
  Banknote,
  BadgeCheck,
  BarChart2,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileImage,
  FileText,
  FolderKanban,
  Hash,
  Inbox,
  Landmark,
  LayoutDashboard,
  Mail,
  Megaphone,
  ScrollText,
  Send,
  Settings,
  Trash2,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/rbac/capabilities";

export type NavRole = "admin" | "staff" | "pejabat" | "viewer";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  statusLabel?: string;
  /** Jika diset, hanya role yang terdaftar di sini yang akan melihat item ini. */
  allowedRoles?: NavRole[];
  requiredCapability?: Capability;
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export const navigationSections: NavigationSection[] = [
  {
    title: "Utama",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        active: true,
      },
      {
        href: "/kalender",
        label: "Kalender",
        icon: CalendarDays,
        active: true,
        requiredCapability: "calendar:view",
      },
      {
        href: "/pengumuman",
        label: "Pengumuman",
        icon: Megaphone,
        active: true,
        requiredCapability: "announcement:view",
      },
      {
        href: "/projects",
        label: "Projects",
        icon: FolderKanban,
        active: true,
        allowedRoles: ["admin", "staff", "pejabat"],
        requiredCapability: "projects:view",
      },
    ],
  },
  {
    title: "Kepegawaian",
    items: [
      {
        href: "/pegawai",
        label: "Pegawai",
        icon: Users,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "pegawai:view",
      },
      {
        href: "/divisi",
        label: "Divisi",
        icon: Building2,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "divisi:view",
      },
    ],
  },
  {
    title: "Persuratan",
    items: [
      {
        href: "/surat-keluar",
        label: "Surat Keluar",
        icon: Send,
        active: true,
        requiredCapability: "surat_keluar:view",
        // semua role yang login bisa lihat arsip
      },
      {
        href: "/surat-masuk",
        label: "Surat Masuk",
        icon: Inbox,
        active: true,
        requiredCapability: "surat_masuk:view",
      },
      {
        href: "/disposisi",
        label: "Disposisi",
        icon: Mail,
        active: true,
        requiredCapability: "disposisi:view",
      },
    ],
  },
  {
    title: "Sertifikat & Kegiatan",
    items: [
      {
        href: "/sertifikat/kegiatan",
        label: "Kegiatan",
        icon: Award,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "sertifikat:view",
      },
      {
        href: "/sertifikat/nomor",
        label: "Penomoran Sertifikat",
        icon: Hash,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "sertifikat:manage",
      },
      {
        href: "/sertifikat/nomor/rekap",
        label: "Rekap Tahunan",
        icon: BarChart2,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "sertifikat:export",
      },
      {
        href: "/sertifikat/peserta",
        label: "Cari Peserta",
        icon: Users,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "sertifikat:view",
      },
      {
        href: "/sertifikat/penandatangan",
        label: "Penandatangan",
        icon: BadgeCheck,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "sertifikat:manage",
      },
      {
        href: "/sertifikat/template",
        label: "Template Sertifikat",
        icon: FileImage,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "sertifikat:configure",
      },
      {
        href: "/sertifikat/analytics",
        label: "Analytics",
        icon: BarChart3,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "sertifikat:view",
      },
      {
        href: "/sertifikat/audit-log",
        label: "Audit Log",
        icon: ScrollText,
        active: true,
        allowedRoles: ["staff"],
        requiredCapability: "audit_log:manage",
      },
      {
        href: "/sertifikat/sampah",
        label: "Sampah",
        icon: Trash2,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "sertifikat:configure",
      },
    ],
  },
  {
    title: "Program Pelatihan",
    items: [
      {
        href: "/jadwal-otomatis",
        label: "Jadwal Kelas",
        icon: Calendar,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:view",
      },
      {
        href: "/jadwal-ujian",
        label: "Jadwal Ujian",
        icon: ClipboardList,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:view",
      },
      {
        href: "/jadwal-otomatis/honorarium",
        label: "Honorarium",
        icon: Banknote,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:view",
      },
      {
        href: "/jadwal-otomatis/instruktur",
        label: "Instruktur",
        icon: Users,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:manage",
      },
    ],
  },
  {
    title: "Keuangan",
    items: [
      {
        href: "/keuangan",
        label: "Dashboard Keuangan",
        icon: Landmark,
        active: true,
        requiredCapability: "keuangan:view",
      },
      {
        href: "/keuangan/honorarium",
        label: "Antrian Pembayaran",
        icon: Banknote,
        active: true,
        requiredCapability: "keuangan:view",
      },
    ],
  },
  {
    title: "Manajemen Ujian",
    items: [
      {
        href: "/jadwal-ujian/admin-jaga",
        label: "Admin Jaga",
        icon: ShieldCheck,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:manage",
      },
      {
        href: "/jadwal-ujian/penugasan",
        label: "Jadwal Pengawas",
        icon: UserCheck,
        active: true,
        requiredCapability: "jadwal_ujian:view",
      },
      {
        href: "/jadwal-ujian/beban-kerja",
        label: "Beban Kerja",
        icon: BarChart2,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:view",
      },
      {
        href: "/jadwal-ujian/pengawas",
        label: "Pengawas",
        icon: Users,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:manage",
      },
      {
        href: "/jadwal-ujian/kelas",
        label: "Kelas",
        icon: BookOpen,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:manage",
      },
      {
        href: "/jadwal-ujian/materi",
        label: "Materi Ujian",
        icon: ClipboardList,
        active: true,
        allowedRoles: ["admin", "staff"],
        requiredCapability: "jadwal_ujian:manage",
      },
      {
        href: "/jadwal-ujian/pengaturan",
        label: "Pengaturan",
        icon: Settings,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "jadwal_ujian:configure",
      },
    ],
  },
  {
    title: "Administrasi",
    items: [
      {
        href: "/surat-keputusan",
        label: "Surat Keputusan",
        icon: FileText,
        active: true,
        allowedRoles: ["admin", "pejabat"],
        requiredCapability: "surat_keputusan:view",
      },
      {
        href: "/surat-mou",
        label: "Surat MOU",
        icon: FileSignature,
        active: true,
        allowedRoles: ["admin", "pejabat"],
        requiredCapability: "surat_mou:view",
      },
      {
        href: "/nomor-surat",
        label: "Nomor Surat",
        icon: Hash,
        active: true,
        allowedRoles: ["admin", "pejabat"],
        requiredCapability: "nomor_surat:view",
      },
      {
        href: "/pejabat",
        label: "Pejabat",
        icon: UserCog,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "pejabat:view",
      },
      {
        href: "/pengaturan",
        label: "Pengaturan",
        icon: Settings,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "pengaturan:view",
      },
      {
        href: "/audit-log",
        label: "Audit Log",
        icon: ShieldCheck,
        active: true,
        allowedRoles: ["admin"],
        requiredCapability: "audit_log:view",
      },
    ],
  },
];

export const navigationItems = navigationSections.flatMap((section) => section.items);

export function getNavigationItem(pathname: string) {
  return navigationItems
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
