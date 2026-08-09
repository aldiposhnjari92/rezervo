import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { THEME_SCRIPT, ThemeProvider, ThemedToaster } from "@/components/theme";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext na duhet për ë dhe ç
  variable: "--font-inter",
  display: "swap",
});


export const metadata: Metadata = {
  title: {
    default: "Rezervo.al — Rezervime online për biznesin tënd",
    template: "%s · Rezervo.al",
  },
  description:
    "Sistemi më i thjeshtë i rezervimeve për berberë, sallone, dentistë dhe lavazhe në Shqipëri. Më pak telefonata, më pak klientë të humbur.",
  openGraph: {
    title: "Rezervo.al — Rezervo Online, Pa Telefonata",
    description: "Krijo faqen e rezervimeve për biznesin tënd në 2 minuta. Falas.",
    locale: "sq_AL",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Vendos temën para pikturimit të parë, që të mos xixëllojë e bardha. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
