import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { UserProfileCard } from "@/components/profil/UserProfileCard";
import { getMyProfile } from "@/server/actions/profile";

export const metadata: Metadata = {
  title: "Profil Saya | ARKA",
};

export default async function ProfilPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  return (
    <PageWrapper
      title="Profil Saya"
      description="Kelola nama, foto, dan informasi kontak Anda."
    >
      <div className="max-w-2xl">
        <UserProfileCard initial={profile} />
      </div>
    </PageWrapper>
  );
}
