import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Ku kthehet Google pas hyrjes.
 *
 * Supabase na dërgon një `code` që duhet shkëmbyer me një sesion. Shkëmbimi
 * bëhet këtu, në server, që token-at të shkojnë direkt në cookies httpOnly
 * dhe të mos kalojnë kurrë nga JavaScript-i i faqes.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const next = searchParams.get("next");

  // Ridrejtimi i brendshëm — kurrë te një host i jashtëm.
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "oauth");
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "missing_code");
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(new URL(destination, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "exchange");
    return NextResponse.redirect(url);
  }

  return response;
}
