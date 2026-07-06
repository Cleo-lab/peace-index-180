"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { groupColor } from "@/lib/colors";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/peace/language-context";

export interface SegmentDef {
  groupKey: string;
  label: string;
  labelEn?: string;
  contribution: number;
  avgProbability: number;
}

interface SpeedometerGaugeProps {
  value: number;
  segments: SegmentDef[];
  className?: string;
}

const CX = 200;
const CY = 200;
const R = 140;
const STROKE = 24;
const VIEW_W = 400;
const VIEW_H = 400;

const ARC_START = 225;
const ARC_END = 495;
const ARC_SPAN = ARC_END - ARC_START; // 270°

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function valueToAngle(v: number): number {
  const normalized = Math.max(-100, Math.min(100, v));
  return ARC_START + ((normalized + 100) / 200) * ARC_SPAN;
}

function arcPath(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const p1 = polar(cx, cy, r, a1);
  const p2 = polar(cx, cy, r, a2);
  const largeArc = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = React.useState(0);
  const ref = React.useRef(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = ref.current;
    const to = target;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setVal(current);
      ref.current = current;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function getTierLabel(value: number, lang: string): string {
  if (value <= -60) return lang === "en" ? "War" : "Война";
  if (value <= -30) return lang === "en" ? "Escalation" : "Эскалация";
  if (value <= -10) return lang === "en" ? "Tension" : "Напряжение";
  if (value <= 10) return lang === "en" ? "Stagnation" : "Стагнация";
  if (value <= 30) return lang === "en" ? "De-escalation" : "Деэскалация";
  if (value <= 60) return lang === "en" ? "Negotiations" : "Переговоры";
  return lang === "en" ? "Peace" : "Мир";
}

export function SpeedometerGauge({
  value,
  segments,
  className,
}: SpeedometerGaugeProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const { lang } = useLanguage();

  const clampedValue = Math.max(-100, Math.min(100, value));
  const animatedValue = useCountUp(clampedValue);
  const displayValue = Math.round(animatedValue);
  const formatted = displayValue > 0 ? `+${displayValue}` : `${displayValue}`;
  const tierLabel = getTierLabel(displayValue, lang);

  const trackColor = dark ? "rgba(255,255,255,0.15)" : "#e5e5e5";
  const trackOpacity = dark ? 1 : 0.3;
  const tickColor = dark ? "rgba(255,255,255,0.5)" : "#999";
  const majorTickColor = dark ? "rgba(255,255,255,0.7)" : "#666";
  const labelColor = dark ? "rgba(255,255,255,0.8)" : "#666";
  const needleColor = dark ? "#e5e5e5" : "#1a1a2e";
  const centerColor = dark ? "#fff" : "#1a1a2e";
  const tierColor = dark ? "rgba(255,255,255,0.6)" : "#666";

  // === СОРТИРОВКА: по убыванию |вклада|, слева направо ===
  const sortedSegments = [...segments].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );
  const totalAbs = sortedSegments.reduce((s, x) => s + Math.abs(x.contribution), 0);

  // === РАСПРЕДЕЛЕНИЕ СЕГМЕНТОВ ПО ВСЕЙ ДУГЕ (-100..+100) ===
  let cursor = ARC_START;
  const arcSegments = sortedSegments.map((seg) => {
    const portion = totalAbs > 0 ? Math.abs(seg.contribution) / totalAbs : 0;
    const angleSpan = portion * ARC_SPAN;
    const start = cursor;
    const end = cursor + angleSpan;
    cursor = end;
    return {
      start,
      end: Math.min(end, ARC_END),
      color: groupColor(seg.groupKey),
      label: seg.label,
      labelEn: seg.labelEn,
      contribution: seg.contribution,
      portion,
    };
  });

  const needleAngle = valueToAngle(animatedValue);
  const needleLen = R - STROKE - 10;
  const needleEnd = polar(CX, CY, needleLen, needleAngle);
  const needleBase1 = polar(CX, CY, 8, needleAngle + 90);
  const needleBase2 = polar(CX, CY, 8, needleAngle - 90);

  const majorTicks = [-100, -75, -50, -25, 0, 25, 50, 75, 100];
  const minorTicks: number[] = [];
  for (let t = -95; t <= 95; t += 5) {
    if (!majorTicks.includes(t)) minorTicks.push(t);
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-full max-w-[400px]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="img"
          aria-label={`Индекс мира: ${displayValue}`}
        >
          {/* Фоновая дуга */}
          <path
            d={arcPath(CX, CY, R, ARC_START, ARC_END)}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            opacity={trackOpacity}
          />

          {/* Сегменты групп — вся дуга от -100 до +100, пропорционально вкладу */}
          {arcSegments.map((seg, i) => (
            <motion.path
              key={`seg-${seg.label}-${i}`}
              d={arcPath(CX, CY, R, seg.start, seg.end)}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.08 }}
            >
              <title>
                {lang === "en" && seg.labelEn ? seg.labelEn : seg.label}
                {" — "}
                {Math.round(seg.portion * 100)}%
              </title>
            </motion.path>
          ))}

          {/* Мелкие тики */}
          {minorTicks.map((tick) => {
            const a = valueToAngle(tick);
            const p1 = polar(CX, CY, R + STROKE / 2 + 2, a);
            const p2 = polar(CX, CY, R + STROKE / 2 + 6, a);
            return (
              <line
                key={`minor-${tick}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={tickColor}
                strokeWidth={1}
                opacity={0.5}
              />
            );
          })}

          {/* Основные тики и метки (-100 … +100) */}
          {majorTicks.map((tick) => {
            const a = valueToAngle(tick);
            const p1 = polar(CX, CY, R + STROKE / 2 + 2, a);
            const p2 = polar(CX, CY, R + STROKE / 2 + 14, a);
            const labelPos = polar(CX, CY, R + STROKE / 2 + 30, a);
            const label = tick > 0 ? `+${tick}` : `${tick}`;

            return (
              <g key={`major-${tick}`}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={majorTickColor}
                  strokeWidth={2}
                  opacity={0.8}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="13"
                  fill={labelColor}
                  fontWeight={tick === 0 ? 700 : 600}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Стрелка */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.3 }}
          >
            <polygon
              points={`${needleBase1.x.toFixed(2)},${needleBase1.y.toFixed(2)} ${needleBase2.x.toFixed(2)},${needleBase2.y.toFixed(2)} ${needleEnd.x.toFixed(2)},${needleEnd.y.toFixed(2)}`}
              fill={needleColor}
              style={{ filter: dark ? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
            />
            <circle cx={CX} cy={CY} r={10} fill={needleColor} />
            <circle cx={CX} cy={CY} r={4} fill={dark ? "#1a1a2e" : "#fff"} />
          </motion.g>

          {/* Центральная цифра — сырой скор */}
          <text
            x={CX}
            y={CY + 55}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="48"
            fontWeight="700"
            fill={centerColor}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatted}
          </text>

          {/* Подпись тира */}
          <text
            x={CX}
            y={CY + 88}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="25"
            fontWeight="600"
            fill={tierColor}
            letterSpacing="0.05em"
          >
            {tierLabel}
          </text>
        </svg>
      </div>

      {/* Легенда вкладов групп */}
      <div className="mt-4 w-full max-w-[360px] space-y-1.5">
        {sortedSegments.map((seg) => {
          const color = groupColor(seg.groupKey);
          const sign = seg.contribution > 0 ? "+" : "";
          const share =
            totalAbs > 0
              ? Math.round((Math.abs(seg.contribution) / totalAbs) * 100)
              : 0;
          return (
            <div key={seg.groupKey} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className={cn("flex-1 leading-tight", dark ? "text-white/60" : "text-muted-foreground")}>
                {lang === "en" && seg.labelEn ? seg.labelEn : seg.label}
              </span>
              <span
                className="font-mono font-semibold tabular-nums"
                style={{ color }}
              >
                {sign}{seg.contribution.toFixed(1)}
              </span>
              <span className={cn("w-10 text-right text-[10px]", dark ? "text-white/40" : "text-muted-foreground")}>
                {share}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

