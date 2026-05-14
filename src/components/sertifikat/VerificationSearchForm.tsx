"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VerificationSearchForm({ initialValue = "" }: { initialValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const noSertifikat = value.trim();
    if (!noSertifikat) return;

    setLoading(true);
    router.push(`/verifikasi/${encodeURIComponent(noSertifikat)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Masukkan nomor sertifikat..."
        className="h-12 rounded-xl border-input bg-background px-4 text-base shadow-none focus-visible:ring-primary/20"
      />
      <Button
        type="submit"
        disabled={loading || value.trim().length === 0}
        className="h-12 rounded-xl px-5"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        <span className="sr-only">Cari</span>
      </Button>
    </form>
  );
}
