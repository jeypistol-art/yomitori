import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "@/components/Providers";
import LegalFooter from "@/components/LegalFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXTAUTH_URL?.trim() ||
  "https://yomitori.org";

const siteTitle = "YOMITORI DocuTask";
const siteDescription =
  "不動産・施設管理会社向けの書類タスク化SaaS。行政通知、契約更新案内、点検報告、メール本文から要約、期限、タスク、リマインド、証跡を整理します。";
const googleAnalyticsId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-SPR3EGLY0M";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteTitle,
  title: {
    default: `${siteTitle} | 書類を、要約・タスク・リマインド・証跡へ。`,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  keywords: [
    "YOMITORI",
    "DocuTask",
    "書類管理",
    "タスク管理",
    "リマインド",
    "管理会社",
    "行政通知",
    "契約更新",
    "点検報告",
  ],
  authors: [{ name: "YOMITORI DocuTask" }],
  creator: "YOMITORI DocuTask",
  publisher: "YOMITORI DocuTask",
  category: "business software",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.ico", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.ico", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: siteTitle,
    title: `${siteTitle} | 書類を、要約・タスク・リマインド・証跡へ。`,
    description: siteDescription,
    images: [
      {
        url: "/images/ogp-yomitori-docutask.png",
        width: 1200,
        height: 630,
        alt: `${siteTitle} - 書類を、要約・タスク・リマインド・証跡へ。`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteTitle} | 書類を、要約・タスク・リマインド・証跡へ。`,
    description: siteDescription,
    images: ["/images/ogp-yomitori-docutask.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
        <LegalFooter />
        <Script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleAnalyticsId}');
          `}
        </Script>
      </body>
    </html>
  );
}
