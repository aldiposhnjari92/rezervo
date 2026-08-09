"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/client";
import { formatDayMonthFromInstant, formatTime } from "@/lib/availability";
import { deleteMyAccount } from "@/lib/admin-actions";

/** I njëjti minimum si te regjistrimi. */
const MIN_PASSWORD = 8;

/** Fjala që duhet shkruar për të konfirmuar fshirjen. */
const CONFIRM_WORD = "FSHIJ";

export function AccountForm({
  email,
  createdAt,
  lastSignInAt,
  isAdmin,
}: {
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [newEmail, setNewEmail] = useState(email);
  const [savingEmail, setSavingEmail] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function changeEmail() {
    const clean = newEmail.trim().toLowerCase();

    if (!clean || !clean.includes("@")) {
      toast.error("Shkruaj një email të vlefshëm.");
      return;
    }
    if (clean === email.toLowerCase()) {
      toast.error("Ky është email-i yt aktual.");
      return;
    }

    setSavingEmail(true);
    const { error } = await createClient().auth.updateUser({ email: clean });
    setSavingEmail(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("already")
          ? "Ky email është i zënë nga një llogari tjetër."
          : "Email-i nuk u ndryshua. Provo sërish.",
      );
      return;
    }

    toast.success("Të dërguam një email konfirmimi te adresa e re. Hape për ta finalizuar.");
  }

  async function changePassword() {
    if (password.length < MIN_PASSWORD) {
      toast.error(`Fjalëkalimi duhet të ketë të paktën ${MIN_PASSWORD} karaktere.`);
      return;
    }
    if (password !== passwordAgain) {
      toast.error("Fjalëkalimet nuk përputhen.");
      return;
    }

    setSavingPassword(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("different")
          ? "Zgjidh një fjalëkalim tjetër nga i mëparshmi."
          : "Fjalëkalimi nuk u ndryshua. Provo sërish.",
      );
      return;
    }

    setPassword("");
    setPasswordAgain("");
    toast.success("Fjalëkalimi u ndryshua.");
  }

  async function confirmDelete() {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) {
      toast.error(`Shkruaj "${CONFIRM_WORD}" për të konfirmuar.`);
      return;
    }

    setDeleting(true);
    const result = await deleteMyAccount();

    if (!result.ok) {
      toast.error(result.error);
      setDeleting(false);
      return;
    }

    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Llogaria ime"
        description="Email-i, fjalëkalimi dhe fshirja e llogarisë."
      />

      {isAdmin && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-4">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm">
            Kjo llogari ka të drejta admini.{" "}
            <a href="/admin" className="font-medium text-primary hover:underline">
              Hap panelin e platformës
            </a>
          </p>
        </div>
      )}

      {/* --------------------------------------------------------------- info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Të dhënat e llogarisë</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Regjistruar</span>
            <span className="font-medium">{formatDayMonthFromInstant(createdAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Hyrja e fundit</span>
            <span className="font-medium">
              {lastSignInAt
                ? `${formatDayMonthFromInstant(lastSignInAt)} · ${formatTime(lastSignInAt)}`
                : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------- email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email</CardTitle>
          <CardDescription>
            Ndryshimi bëhet efektiv pasi të konfirmosh linkun që dërgohet te adresa e re.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-email">Adresa e email-it</Label>
            <Input
              id="account-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={savingEmail}
            />
          </div>
          <Button onClick={changeEmail} disabled={savingEmail}>
            {savingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
            Ndrysho email-in
          </Button>
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- fjalëkalimi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fjalëkalimi</CardTitle>
          <CardDescription>Të paktën {MIN_PASSWORD} karaktere.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Fjalëkalimi i ri</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={savingPassword}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password-again">Përsërite fjalëkalimin</Label>
            <Input
              id="new-password-again"
              type="password"
              autoComplete="new-password"
              value={passwordAgain}
              onChange={(e) => setPasswordAgain(e.target.value)}
              disabled={savingPassword}
            />
          </div>
          <Button onClick={changePassword} disabled={savingPassword || !password}>
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
            Ndrysho fjalëkalimin
          </Button>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ fshirja */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Fshi llogarinë
          </CardTitle>
          <CardDescription>
            Fshihen përgjithmonë biznesi, shërbimet dhe të gjitha rezervimet. Nuk kthehet mbrapsht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">
              Llogaritë me të drejta admini nuk fshihen nga paneli.
            </p>
          ) : (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Fshi llogarinë time
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(next) => !deleting && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Je i sigurt?</DialogTitle>
            <DialogDescription>
              Llogaria, biznesi, shërbimet dhe rezervimet fshihen përgjithmonë. Klientët që kanë
              rezervime nuk do të njoftohen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Shkruaj <span className="font-mono font-semibold">{CONFIRM_WORD}</span> për të
              konfirmuar
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              disabled={deleting}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Anulo
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Fshi përgjithmonë
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pb-2">
        <Badge variant="secondary">{email}</Badge>
      </div>
    </div>
  );
}
