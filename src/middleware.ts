import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rrugët e panelit të pronarit. Këto emra janë gjithashtu të rezervuar si
 * slug-e biznesi (shih `RESERVED_SLUGS`), që të mos përplasen me /[slug].
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/calendar",
  "/customers",
  "/services",
  "/settings",
  "/setup",
  "/account",
  "/admin",
];

const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^https:/, "wss:");

/**
 * Content-Security-Policy me nonce të ri për çdo kërkesë.
 *
 * `strict-dynamic` do të thotë: beso vetëm skriptet që mbajnë këtë nonce, dhe ato
 * që ngarkojnë ato vetë. Kështu, edhe nëse dikush arrin të fusë një `<script>` në
 * faqe, shfletuesi nuk e ekzekuton — nuk e ka nonce-in e kësaj kërkese.
 *
 * `style-src` mban 'unsafe-inline': next/font injekton stile inline dhe nonce-t
 * mbi stile nuk mbulohen mirë nga shfletuesit. Rreziku është shumë më i vogël se
 * te skriptet.
 */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' i duhet vetëm HMR-së në zhvillim; në prodhim nuk lejohet.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Fotot e profilit të Google vijnë nga lh3; pa këtë, CSP-ja i bllokon dhe
    // avatari mbetet bosh për këdo që hyn me Google.
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    // Supabase: REST/Auth mbi https, realtime mbi websocket.
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

function withSecurityHeaders(response: NextResponse, nonce: string, isDev: boolean) {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.headers.set("X-DNS-Prefetch-Control", "off");

  // HSTS vetëm në prodhim — te localhost do të detyronte https pa nevojë.
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Nonce-i i kalohet renderimit përmes një header-i kërkese, që layout-i rrënjë
  // ta vendosë te skripti inline i temës.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  /**
   * Një pronar i kyçur nuk ka pse të shohë faqen e shitjes.
   *
   * Kontrollohet vetëm PRANIA e cookie-t të sesionit, jo vlefshmëria e tij: një
   * `getUser()` këtu do të thoshte një thirrje drejt Supabase-it në ÇDO vizitë të
   * faqes publike, edhe për vizitorët e panjohur — të cilët janë shumica.
   * Nëse cookie-ja del e pavlefshme, /dashboard e kontrollon si duhet dhe e çon
   * te /login. Kostoja e gabimit është një ridrejtim, jo një hyrje e paautorizuar.
   */
  if (pathname === "/") {
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

    if (hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return withSecurityHeaders(NextResponse.redirect(url), nonce, isDev);
    }
  }

  // Faqet publike nuk kanë nevojë për kontroll sesioni — do të ishte një thirrje
  // e kotë drejt Supabase-it në çdo vizitë të faqes së rezervimit.
  if (!isProtected && pathname !== "/login") {
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      nonce,
      isDev,
    );
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  // Rifreskon token-in e skaduar dhe e shkruan në cookies të përgjigjes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(url), nonce, isDev);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url), nonce, isDev);
  }

  return withSecurityHeaders(response, nonce, isDev);
}

export const config = {
  // Çdo rrugë përveç aseteve statike: header-at e sigurisë duhen kudo, jo vetëm
  // te faqet e mbrojtura.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
