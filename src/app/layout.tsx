
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/peace/language-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Индекс Мира 180 — Peace Index 180",
  description:
    "Аналитическое приложение, оценивающее вероятность наступления мира в Украине в течение 180 дней на основе открытых данных с помощью ИИ. Не является официальным прогнозом.",
  keywords: [
    "Peace Index",
    "Индекс Мира",
    "Ukraine",
    "вероятность мира",
    "AI analytics",
    "open data",
  ],
  authors: [{ name: "Peace Index 180" }],
  openGraph: {
    title: "Индекс Мира 180 — Peace Index 180",
    description: "AI-аналитика вероятности мира в Украине за 180 дней",
    url: "https://peace-index-180.vercel.app/",
    siteName: "Peace Index 180",
    images: [{
      url: "/api/og?lang=ru",
      width: 1200,
      height: 630,
      alt: "Индекс Мира 180",
    }],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Индекс Мира 180",
    description: "AI-аналитика вероятности мира в Украине за 180 дней",
    images: ["/api/og?lang=ru"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Индекс Мира 180",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
        <LanguageProvider>
    {children}
  </LanguageProvider>
  <Toaster />
          <SonnerToaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}


