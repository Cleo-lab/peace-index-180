// app/widget/layout.tsx
import type { Metadata } from "next";
import { ReactNode } from "react";

// Форсируем динамический рендеринг для всего сегмента /widget — без этого
// generateMetadata() (и её fetch к /api/status) мог закэшироваться один раз
// на моменте сборки и больше никогда не обновляться, из-за чего og:title
// показывал устаревшее "0%" даже когда og:image (у него свой отдельный
// force-dynamic в route.tsx) уже отдавал актуальное значение.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UI_TEXT = {
  ru: {
    appTitle: "Индекс Мира 180",
    appSubtitle: "Вероятность мира за 180 дней",
    description: "AI-аналитика вероятности мира в Украине за 180 дней на основе открытых данных",
  },
  en: {
    appTitle: "Peace Index 180",
    appSubtitle: "180-day peace probability",
    description: "AI-powered analytics of peace probability in Ukraine over 180 days based on open data",
  },
};

async function fetchStatus() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/status`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Next.js 16: searchParams — объект, не Promise
export async function generateMetadata({ 
  searchParams 
}: { 
  searchParams?: Record<string, string | string[] | undefined> 
}): Promise<Metadata> {
  const rawLang = searchParams?.lang;
  const lang = typeof rawLang === "string" && rawLang === "en" ? "en" : "ru";
  const t = UI_TEXT[lang];

  const data = await fetchStatus();
  const value = data?.aggregate?.totalProbability ?? 0;
  const summary = lang === "ru" ? data?.aggregate?.summaryRu : data?.aggregate?.summaryEn;
  const formatted = value > 0 ? `+${value}` : `${value}`;

  const title = `${t.appTitle}: ${formatted}% — ${t.appSubtitle}`;
  const description = summary ? summary.slice(0, 160) : t.description;
  const ogImageUrl = `https://peace-index-180.vercel.app/api/og?lang=${lang}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://peace-index-180.vercel.app/widget?lang=${lang}`,
      siteName: t.appTitle,
      images: [{
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: t.appTitle,
      }],
      locale: lang === "ru" ? "ru_RU" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function WidgetLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
