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
import { useFormat, useT } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
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
  const t = useT();
  const fmt = useFormat();

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
      toast.error(t("account.badEmail"));
      return;
    }
    if (clean === email.toLowerCase()) {
      toast.error(t("account.currentEmail"));
      return;
    }

    setSavingEmail(true);
    const { error } = await createClient().auth.updateUser({ email: clean });
    setSavingEmail(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("already")
          ? t("account.emailTaken")
          : t("account.emailFailed"),
      );
      return;
    }

    toast.success(t("account.emailConfirmSent"));
  }

  async function changePassword() {
    if (password.length < MIN_PASSWORD) {
      toast.error(`Fjalëkalimi duhet të ketë të paktën ${MIN_PASSWORD} karaktere.`);
      return;
    }
    if (password !== passwordAgain) {
      toast.error(t("account.passwordMismatch"));
      return;
    }

    setSavingPassword(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("different")
          ? t("account.samePassword")
          : t("account.passwordFailed"),
      );
      return;
    }

    setPassword("");
    setPasswordAgain("");
    toast.success(t("account.passwordChanged"));
  }

  async function confirmDelete() {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) {
      toast.error(t("account.typeWord", { word: t("account.deleteConfirm") }));
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
        title={t("account.title")}
        description={t("account.subtitle")}
      />

      {isAdmin && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm">
            {t("account.isAdmin")}{" "}
            <a href="/admin" className="font-medium text-primary hover:underline">
              Hap panelin e platformës
            </a>
          </p>
        </div>
      )}

      {/* --------------------------------------------------------------- info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("account.dataTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("admin.registered")}</span>
            <span className="font-medium">{fmt.dayMonthFromInstant(createdAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("admin.lastSignIn")}</span>
            <span className="font-medium">
              {lastSignInAt
                ? `${fmt.dayMonthFromInstant(lastSignInAt)} · ${fmt.time(lastSignInAt)}`
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
            <Label htmlFor="account-email">{t("account.emailAddress")}</Label>
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
            {t("account.changeEmail")}
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
            <Label htmlFor="new-password">{t("account.newPassword")}</Label>
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
            <Label htmlFor="new-password-again">{t("account.repeatPassword")}</Label>
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
            {t("account.changePassword")}
          </Button>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ fshirja */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t("account.deleteTitle")}
          </CardTitle>
          <CardDescription>
            {t("account.deleteHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">
              {t("account.adminCannotDelete")}
            </p>
          ) : (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              {t("account.deleteMine")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(next) => !deleting && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("account.sure")}</DialogTitle>
            <DialogDescription>
              {t("account.deleteBody")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              {t("account.typeToConfirm", { word: CONFIRM_WORD })}
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
