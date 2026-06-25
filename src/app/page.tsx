"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeroSection, type HeroJobView } from "@/components/peace/hero-section";
import { GroupOverview, type GroupRow } from "@/components/peace/group-overview";
import { type SegmentDef } from "@/components/peace/speedometer-gauge";
import { HistoryChart } from "@/components/peace/history-chart";
import { Disclaimer } from "@/components/peace/disclaimer";
import { AboutModal } from "@/components/peace/about-modal";
import { MethodologyModal } from "@/components/peace/methodology-modal";
import { DonateModal } from "@/components/peace/donate-modal";
import { BurgerMenu } from "@/components/peace/burger-menu";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Moon,
  Sun,
  Github,
  Activity,
  ChevronDown,
  Layers,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

interface AggregateView {
  totalProbability: number;
  summaryEn: string;
  summaryRu: string | null;
  markerCount: number;
}

interface StatusResponse {
  job: HeroJobView;
  calcDate: string | null;
  today: string;
  totalMarkers: number;
  aggregate: AggregateView | null;
  markers: import("@/components/peace/marker-card").MarkerView[];
  groups: { key: string; labelRu: string; label: string; tier: string }[];
}

interface HistoryPoint {
  date: string;
  probability: number;
  markerCount: number;
}

const GROUP_ORDER = ["finance", "law", "escalation", "ukraine_military", "russia", "politics"] as const;

export default function Home() {
  const [status, setStatus] = React.useState<StatusResponse | null>(null);
  const [history, setHistory] = React.useState<HistoryPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<string[]>([]);
  const [showMethodology, setShowMethodology] = React.useState(false);

  // Состояния модалов
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [methodologyOpen, setMethodologyOpen] = React.useState(false);
  const [donateOpen, setDonateOpen] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Опрос /api/status
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = (await res.json()) as StatusResponse;
        if (!cancelled) {
          setStatus(data);
          setLoading(false);
          if (data.job.running) timer = setTimeout(fetchStatus, 1500);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          toast.error("Не удалось получить состояние индекса");
        }
      }
    }
    fetchStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tick]);

  React.useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      try {
        const res = await fetch("/api/history?days=90", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.points)) setHistory(data.points);
      } catch {
        /* ignore */
      }
    }
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [status?.aggregate?.totalProbability, status?.job?.finishedAt]);

  const aggregate = status?.aggregate ?? null;
  const markers = status?.markers ?? [];
  const groups = status?.groups ?? [];
  const calcDate = status?.calcDate ?? null;
  const job = status?.job ?? null;
  const totalMarkers = status?.totalMarkers ?? 24;

  // Группировка маркеров + вычисление вкладов
  const { groupRows, segments } = React.useMemo(() => {
    const map: Record<string, import("@/components/peace/marker-card").MarkerView[]> = {};
    for (const m of markers) (map[m.group] ??= []).push(m);

    const rows: GroupRow[] = GROUP_ORDER.map((key) => {
      const list = map[key] ?? [];
      const weight = list.reduce((s, m) => s + m.weight, 0);
      const wp = list.reduce((s, m) => s + m.weight * m.probability, 0);
      const avg = weight > 0 ? wp / weight : 0;
      const meta = groups.find((g) => g.key === key);
      return {
        key,
        labelRu: meta?.labelRu ?? key,
        avg,
        weight,
        count: list.length,
        contribution: 0,
        markers: list,
        calcDate: calcDate ?? "",
      };
    }).filter((g) => g.count > 0);

    const totalWeight = rows.reduce((s, g) => s + g.weight, 0);
    for (const r of rows) {
      r.contribution = totalWeight > 0 ? (r.weight / totalWeight) * r.avg : 0;
    }

    const segs: SegmentDef[] = rows.map((r) => ({
      groupKey: r.key,
      label: r.labelRu,
      contribution: r.contribution,
      avgProbability: r.avg,
    }));

    return { groupRows: rows, segments: segs };
  }, [markers, groups, calcDate]);

  const hasData = aggregate !== null && markers.length > 0;

  function toggleGroup(key: string) {
    setOpenGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }
  function expandAll() {
    setOpenGroups(groupRows.map((g) => g.key));
  }
  function collapseAll() {
    setOpenGroups([]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header с бургер-меню */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight sm:text-lg">
                Индекс Мира 180
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                Peace Index 180 · AI-аналитика открытых данных
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex"
              aria-label="Исходный код"
            >
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Github className="h-4 w-4" />
              </Button>
            </a>
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label="Переключить тему"
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            <BurgerMenu
              onAbout={() => setAboutOpen(true)}
              onMethodology={() => setMethodologyOpen(true)}
              onDonate={() => setDonateOpen(true)}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-6 sm:px-6 sm:py-10">
        {loading ? (
          <Skeleton className="h-[420px] w-full rounded-3xl" />
        ) : hasData ? (
          <>
            {/* HERO */}
            <HeroSection
              totalProbability={aggregate!.totalProbability}
              summaryEn={aggregate!.summaryEn}
              summaryRu={aggregate!.summaryRu}
              calcDate={calcDate}
              markerCount={aggregate!.markerCount}
              totalMarkers={totalMarkers}
              job={job}
              refreshTick={tick}
              segments={segments}
            />

            {/* Структура индекса */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Layers className="h-4.5 w-4.5 text-muted-foreground" />
                    Структура индекса
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {markers.length} маркеров в 6 группах · кликните группу, чтобы
                    раскрыть её маркеры
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={expandAll}>
                    Раскрыть все
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={collapseAll}>
                    Свернуть все
                  </Button>
                </div>
              </div>

              <GroupOverview
                groups={groupRows}
                openKeys={openGroups}
                onToggle={toggleGroup}
              />
            </motion.section>

            {/* График истории */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4 }}
            >
              <HistoryChart points={history} current={aggregate!.totalProbability} />
            </motion.section>

            {/* Методология — оставляем как Collapsible на главной */}
            <section>
              <Collapsible open={showMethodology} onOpenChange={setShowMethodology}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/40">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                          <BookOpen className="h-4.5 w-4.5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">Как считается индекс</h3>
                          <p className="text-xs text-muted-foreground">
                            Методология, маркеры, шкала -100..+100 и источники данных
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${showMethodology ? "rotate-180" : ""}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <AnimatePresence initial={false}>
                    {showMethodology && (
                      <CollapsibleContent asChild>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border p-5">
                            <div className="grid gap-4 text-sm sm:grid-cols-2">
                              <MethodItem
                                title="Горизонт прогноза"
                                text="180 дней. «Мир» = прекращение огня, заморозка конфликта или мирный договор. Шкала: -100 (война) → 0 (стагнация) → +100 (мир)."
                              />
                              <MethodItem
                                title="Маркеры и веса"
                                text="24 маркера в 6 группах. Финансовые и законодательные маркеры имеют максимальный вес (до 12). Политические — минимальный (до 3)."
                              />
                              <MethodItem
                                title="Дуговой спидометр"
                                text="Цветные сегменты = вклады групп маркеров. Левая сторона = факторы войны, правая = факторы мира. Длина сегмента ∝ вклад группы."
                              />
                              <MethodItem
                                title="Антигаллюцинации"
                                text="ИИ обязан ссылаться на URL источников. На сервере факты фильтруются: остаются только с URL из собранных данных."
                              />
                              <MethodItem
                                title="Градиент давности"
                                text="Если по маркеру нет данных >14 дней, уверенность падает до LOW. Для тяжёлых маркеров (вес >8) индекс корректируется к нейтрали."
                              />
                              <MethodItem
                                title="Источники данных"
                                text="IMF, MIGA, DFC, EBRD, Kiel, ISW, ACLED, Oryx, Verkhovna Rada, Prozorro, Eur-Lex, Kremlin, Reuters/AP, OSINT, Google News RSS."
                              />
                            </div>
                          </div>
                        </motion.div>
                      </CollapsibleContent>
                    )}
                  </AnimatePresence>
                </Card>
              </Collapsible>
            </section>
          </>
        ) : (
          <EmptyState
            running={job?.running ?? false}
            progress={job?.progress ?? null}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-card/50">
        <div className="mx-auto w-full max-w-6xl space-y-3 px-4 py-6 sm:px-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <Disclaimer />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Peace Index 180 · некоммерческий проект · open data + AI</span>
            <span>горизонт 180 дней · автообновление ежедневно в 02:00 UTC</span>
          </div>
        </div>
      </footer>

      {/* Модалы */}
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} />
    </div>
  );
}

function MethodItem({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function EmptyState({
  running,
  progress,
}: {
  running: boolean;
  progress: HeroJobView["progress"];
}) {
  return (
    <Card className="mt-6 flex flex-col items-center justify-center p-12 text-center">
      {running ? (
        <>
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600 dark:border-emerald-950 dark:border-t-emerald-400" />
          </div>
          <h3 className="mt-5 text-lg font-semibold">Идёт первый расчёт…</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {progress?.current ?? "Подготовка данных"}
          </p>
          <p className="mt-4 max-w-md text-xs text-muted-foreground">
            Система анализирует 24 маркера с помощью ИИ и Google News RSS.
            Расчёт занимает 3–4 минуты. Данные обновляются автоматически каждые сутки.
          </p>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
            <Activity className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-lg font-semibold">Данных пока нет</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Первый расчёт выполняется автоматически по расписанию (02:00 UTC).
            Пожалуйста, проверьте позже или запустите вручную через GitHub Actions.
          </p>
        </>
      )}
    </Card>
  );
}

