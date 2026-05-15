import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { requirePermission } from "@/server/actions/auth";
import { KelolaSaldoCutiPage } from "@/components/cuti/KelolaSaldoCutiPage";

export const metadata: Metadata = {
  title: "Kelola Saldo Cuti | ARKA",
};

export default async function Page() {
  await requirePermission("saldoCuti", "manage");

  return (
    <PageWrapper
      title="Kelola Saldo Cuti"
      description="Generate saldo tahunan, kelola cuti bersama, dan konfigurasi kuota cuti."
    >
      <KelolaSaldoCutiPage />
    </PageWrapper>
  );
}
