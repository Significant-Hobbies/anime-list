import { SaasMakerAnalytics } from '@/components/SaasMakerAnalytics'
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth";
import { QueryProvider } from "@/lib/query-provider";
import FeedbackWidgetWrapper from "@/components/FeedbackWidgetWrapper";
import { AnalyticsProvider } from "@/components/posthog-provider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const siteUrl = "https://anime-list-9lk.pages.dev";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "anime", "manga", "myanimelist", "anime discovery", "manga discovery",
    "anime tracker", "watchlist", "anime search", "manga search",
  ],
  authors: [{ name: "Sarthak Agrawal" }],
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    type: "website",
    url: siteUrl,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        data-analytics="true"
        className={`min-h-screen bg-background text-foreground ${inter.variable} ${inter.className}`}
      >
        <AnalyticsProvider>
          <SaasMakerAnalytics />
          <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
          <Script
            id="structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: SITE_NAME,
                description: SITE_DESCRIPTION,
                url: siteUrl,
                applicationCategory: "EntertainmentApplication",
                operatingSystem: "Web",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
              }),
            }}
          />
          <NuqsAdapter>
            <QueryProvider>
              <AuthProvider>
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 pt-8">{children}</main>
                <Footer />
                <FeedbackWidgetWrapper />
              </AuthProvider>
            </QueryProvider>
          </NuqsAdapter>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
