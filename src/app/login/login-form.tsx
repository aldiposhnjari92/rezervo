"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/provider";
import type { DictKey } from "@/lib/i18n/sq";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

/**
 * Kjo llogari mban numra telefoni klientësh. 6 karaktere ishin shumë pak.
 * Kufiri i vërtetë vendoset te Supabase (Auth -> Policies); ky është vetëm
 * kontrolli që i kursen përdoruesit një udhëtim te serveri.
 */
const MIN_PASSWORD = 8;

/**
 * Supabase i kthen gabimet vetëm në anglisht. Këtu kthehen në ÇELËSA, jo në
 * tekst: përkthimi bëhet te komponenti, ku gjuha aktuale dihet.
 */
function authErrorKey(message: string): DictKey {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "login.wrongCredentials";
  if (m.includes("user already registered")) return "login.emailRegistered";
  if (m.includes("password should be at least")) return "login.shortPassword";
  if (m.includes("email not confirmed")) return "login.confirmFirst";
  if (m.includes("unable to validate email")) return "login.badEmail";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("breach"))
    return "login.pwned";
  if (m.includes("rate limit") || m.includes("too many")) return "login.rateLimited";
  return "err.generic";
}

const OAUTH_ERRORS: Record<string, DictKey> = {
  oauth: "login.googleCancelled",
  missing_code: "login.googleBadCode",
  exchange: "login.noSession",
};

export function LoginForm({
  initialMode,
  next,
  googleEnabled = false,
  oauthError,
}: {
  initialMode: Mode;
  next?: string;
  googleEnabled?: boolean;
  oauthError?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isSignup = mode === "signup";

  // Gabimi vjen si parametër URL-je pasi Google na kthen te /auth/callback.
  // Varet vetëm nga `oauthError`: një ndryshim gjuhe nuk duhet ta rishfaqë
  // njoftimin për një gabim që përdoruesi e ka parë tashmë.
  useEffect(() => {
    if (oauthError) toast.error(t(OAUTH_ERRORS[oauthError] ?? "login.googleFailed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthError]);

  async function signInWithGoogle() {
    setGoogleLoading(true);

    const callback = new URL("/auth/callback", window.location.origin);
    if (next && next.startsWith("/")) callback.searchParams.set("next", next);

    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (error) {
      toast.error(t("login.googleFailed"));
      setGoogleLoading(false);
    }
    // Në sukses shfletuesi largohet drejt Google — mos e hiq gjendjen e ngarkimit.
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      toast.error(t("login.fillBoth"));
      return;
    }
    if (isSignup && password.length < MIN_PASSWORD) {
      toast.error(`Fjalëkalimi duhet të ketë të paktën ${MIN_PASSWORD} karaktere.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) {
          toast.error(t(authErrorKey(error.message)));
          return;
        }

        // Nëse konfirmimi me email është aktiv, s'ka sesion ende.
        if (!data.session) {
          toast.success(t("auth.confirmSent"));
          setMode("signin");
          return;
        }

        toast.success(t("auth.accountCreated"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          toast.error(t(authErrorKey(error.message)));
          return;
        }
      }

      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      toast.error(t("login.offline"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-9">
        <h1 className="text-balance text-3xl font-bold tracking-tight">
          {isSignup ? t("auth.createTitle") : t("auth.welcomeBack")}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {isSignup
            ? t("auth.createBody")
            : t("auth.welcomeBackBody")}
        </p>
      </div>

      <div>
        {googleEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full rounded-full"
              onClick={signInWithGoogle}
              disabled={googleLoading || loading}
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
              {t("auth.withGoogle")}
            </Button>

            <div className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{t("auth.orEmail")}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
<Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="emri@shembull.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
<Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? `Të paktën ${MIN_PASSWORD} karaktere` : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? MIN_PASSWORD : undefined}
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full shadow-lg shadow-primary/25"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignup ? t("auth.createAccount") : t("auth.signIn")}
          </Button>
        </form>

        <div className="mt-7 border-t border-border pt-5 text-sm text-muted-foreground">
          {isSignup ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setMode(isSignup ? "signin" : "signup")}
            disabled={loading}
          >
            {isSignup ? t("auth.signInHere") : t("auth.signUp")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Logoja zyrtare e Google — ngjyrat janë të fiksuara, s'ndryshojnë me temën. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.08 3.59-5.15 3.59-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
