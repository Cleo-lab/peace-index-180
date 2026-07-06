// app/widget/layout.tsx
import type { Metadata } from "next";
import { ReactNode } from "react";

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

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const params = await Promise.resolve(searchParams ?? {});
  const rawLang = params.lang;
  const lang = typeof rawLang === "string" && rawLang === "en" ? "en" : "ru";
  const t = UI_TEXT[lang];

  // Добавляем дату в URL, чтобы соцсети не кэшировали старую картинку
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const ogImageUrl = `https://peace-index-180.vercel.app/api/og?lang=${lang}&d=${today}`;
  const title = `${t.appTitle} — ${t.appSubtitle}`;

  return {
    title,
    description: t.description,
    openGraph: {
      title,
      description: t.description,
      url: `https://peace-index-180.vercel.app/widget?lang=${lang}`,
      siteName: t.appTitle,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: t.appTitle,
        },
      ],
      locale: lang === "ru" ? "ru_RU" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t.description,
      images: [ogImageUrl],
    },
  };
}

export default function WidgetLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

