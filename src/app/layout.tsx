import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { THEME_SCRIPT, ThemeProvider, ThemedToaster } from "@/components/theme";
import { getLocale } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext na duhet për ë dhe ç
  variable: "--font-inter",
  display: "swap",
});


/** Metadata ndjek gjuhën: titulli dhe përshkrimi janë tekst i dukshëm. */
export function generateMetadata(): Metadata {
  const locale = getLocale();
  const sq = locale === "sq";

  return {
    title: {
      default: sq
        ? "Rezervo.al — Rezervime online për biznesin tënd"
        : "Rezervo.al — Online bookings for your business",
      template: "%s · Rezervo.al",
    },
    description: sq
      ? "Sistemi më i thjeshtë i rezervimeve për berberë, sallone, dentistë dhe lavazhe në Shqipëri. Më pak telefonata, më pak klientë të humbur."
      : "The simplest booking system for barbers, salons, dentists and car washes in Albania. Fewer phone calls, fewer lost customers.",
    openGraph: {
      title: sq
        ? "Rezervo.al — Rezervo Online, Pa Telefonata"
        : "Rezervo.al — Book online, without the phone calls",
      description: sq
        ? "Krijo faqen e rezervimeve për biznesin tënd në 2 minuta. Falas."
        : "Create a booking page for your business in 2 minutes. Free.",
      locale: sq ? "sq_AL" : "en_US",
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();

  // Nonce-i vjen nga middleware. Pa të, CSP-ja e bllokon skriptin e temës dhe
  // faqja do të xixëllonte e bardhë para se të bëhej e errët.
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Vendos temën para pikturimit të parë, që të mos xixëllojë e bardha. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans">
        <ThemeProvider>
          <I18nProvider locale={locale}>
            {children}
            <ThemedToaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
