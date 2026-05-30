"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendTestEmail } from "@/server/actions/mail-templates/test-send";

interface Props {
  templateId: string;
  templateName: string;
  customVariables?: Record<string, string>;
}

export function TestSendDialog({ templateId, templateName, customVariables }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    if (!email) {
      toast.error("Masukkan alamat email");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendTestEmail({
        templateId,
        recipientEmail: email,
        variables: customVariables,
      });

      if (result.success) {
        toast.success(`Test email berhasil dikirim ke ${email}`);
        setOpen(false);
      } else {
        toast.error(result.error ?? "Gagal mengirim test email");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat mengirim");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="mr-1 h-4 w-4" />
          Test Send
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test Send Email</DialogTitle>
          <DialogDescription>
            Kirim test email untuk template &ldquo;{templateName}&rdquo;.
            Subject akan diberi prefix [TEST].
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Alamat Email Penerima</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Email akan dikirim menggunakan sample data. Maks 5 test per menit.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSend} disabled={isSending || !email}>
            {isSending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Send className="mr-1 h-4 w-4" />
                Kirim Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
