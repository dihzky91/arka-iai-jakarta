import { redirect } from "next/navigation";

export default async function Page() {
  redirect("/surat-keluar?jenis=mou");
}
