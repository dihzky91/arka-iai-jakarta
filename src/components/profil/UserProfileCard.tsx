"use client";

import { useState, useTransition } from "react";
import { Loader2, Upload, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateMyProfile, type ProfileRow } from "@/server/actions/profile";

interface Props {
  initial: ProfileRow;
}

export function UserProfileCard({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateMyProfile(formData);
      if (result.ok) {
        toast.success("Profil berhasil disimpan.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Profil Saya</CardTitle>
            <CardDescription>
              Kelola informasi pribadi yang ditampilkan di aplikasi.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name & Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="namaLengkap">Nama Lengkap</Label>
              <Input
                id="namaLengkap"
                name="namaLengkap"
                defaultValue={initial.namaLengkap}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Login</Label>
              <Input value={initial.email} disabled readOnly />
              <p className="text-xs text-muted-foreground">
                Email login tidak dapat diubah.
              </p>
            </div>
          </div>

          <Separator />

          {/* Optional fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emailPribadi">Email Pribadi (opsional)</Label>
              <Input
                id="emailPribadi"
                name="emailPribadi"
                type="email"
                defaultValue={initial.emailPribadi ?? ""}
                placeholder="email.pribadi@contoh.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noHp">No. HP (opsional)</Label>
              <Input
                id="noHp"
                name="noHp"
                defaultValue={initial.noHp ?? ""}
                placeholder="08xxxxxxxxxx"
                maxLength={20}
              />
            </div>
          </div>

          {/* Avatar */}
          <div className="space-y-2">
            <Label>Foto Profil (Avatar)</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/30">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <Input
                type="file"
                name="avatar"
                accept="image/png,image/jpeg,image/webp"
                className="w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setAvatarPreview(URL.createObjectURL(file));
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, atau WebP. Disarankan format square.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Profil
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
