"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SegmentDef {
  groupKey: string;
  label: string;
  contribution: number;
  avgProbability: number;
}

interface SpeedometerGaugeProps {
  value: number; // -100..+100
  segments: SegmentDef[];
  className?: string;
  /** Тёмная тема (для виджета на чёрном фоне) */
  dark?: boolean;
}

// ===== Цвета групп (fallback) =====
const GROUP_COLORS: Record<string, string> = {
  finance: "#10b981",
  law: "#84cc16",
  escalation: "#dc2626",
  ukraine_military: "#e11d48",
  russia: "#f97316",
  politics: "#d946ef",
};

function groupColor(key: string): string {
  try {
    const { groupColor: imported } = require("@/lib/colors");
    if (imported) return imported(key);
  } catch {
    // fallback
  }
  return GROUP_COLORS[key] || "#999";
}

// ===== Геометрия: дуга 270° с зазором 90° снизу =====
// Система polar: 0° = верх (12:00), 90° = право (3:00), 180° = низ (6:00), 270° = лево (9:00)
//
// На рисунке:
//   0    = верх (12:00)          → 0°   (или 360°)
//   -100 = левый низ (~7:30)     → 225°
//   +100 = правый низ (~4:30)    → 135°  но в arcPath идём по часовой: 225°→360°→495°(=135°+360°)
//
// Дуга по часовой: от 225° через 360°(верх) к 495°
// Зазор снизу: от 135° до 225° (90°)

const CX = 200;
const CY = 200;
const R = 140;
const STROKE = 24;
const VIEW_W = 400;
const VIEW_H = 400;

const ARC_START = 225;   // -100 (левый низ, ~7:30)
const ARC_END = 495;     // +100 (правый низ, ~4:30) = 135° + 360°
const ARC_MID = 360;     // 0 (верх, 12:00)

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  // 0° = верх, по часовой
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function valueToAngle(v: number): number {
  const normalized = Math.max(-100, Math.min(100, v));
  // -100..+100 → 225°..495° (диапазон 270°)
  return ARC_START + ((normalized + 100) / 200) * (ARC_END - ARC_START);
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

function getTierLabel(value: number): string {
  if (value <= -60) return "Война";
  if (value <= -30) return "Эскалация";
  if (value <= -10) return "Напряжение";
  if (value <= 10) return "Стагнация";
  if (value <= 30) return "Деэскалация";
  if (value <= 60) return "Переговоры";
  return "Мир";
}

export function SpeedometerGauge({
  value,
  segments,
  className,
  dark = false,
}: SpeedometerGaugeProps) {
  const clampedValue = Math.max(-100, Math.min(100, value));
  const animatedValue = useCountUp(clampedValue);
  const displayValue = Math.round(animatedValue);
  const formatted = displayValue > 0 ? `+${displayValue}` : `${displayValue}`;
  const tierLabel = getTierLabel(displayValue);

  // Цвета для тёмной/светлой темы
  const trackColor = dark ? "rgba(255,255,255,0.15)" : "#e5e5e5";
  const trackOpacity = dark ? 1 : 0.3;
  const tickColor = dark ? "rgba(255,255,255,0.5)" : "#999";
  const majorTickColor = dark ? "rgba(255,255,255,0.7)" : "#666";
  const labelColor = dark ? "rgba(255,255,255,0.8)" : "#666";
  const needleColor = dark ? "#e5e5e5" : "#1a1a2e";
  const centerColor = dark ? "#fff" : "#1a1a2e";
  const tierColor = dark ? "rgba(255,255,255,0.6)" : "#666";

  // ===== Разделяем сегменты =====
  const positiveSegments = segments.filter((s) => s.contribution > 0);
  const negativeSegments = segments.filter((s) => s.contribution < 0);

  const totalPositive = positiveSegments.reduce((s, x) => s + x.contribution, 0);
  const totalNegative = Math.abs(negativeSegments.reduce((s, x) => s + x.contribution, 0));
  const totalAbs = totalPositive + totalNegative;

  // ===== Формируем цветные сегменты дуги =====
  // Левая сторона (-100..0): от 225° до 360° (135° диапазон)
  const leftSegments: Array<{ start: number; end: number; color: string; label: string }> = [];
  if (totalNegative > 0) {
    let cursor = ARC_MID; // 360° (верх, 0)
    for (const seg of negativeSegments) {
      const portion = Math.abs(seg.contribution) / totalNegative;
      const angleSpan = portion * 135; // 135° = левая половина дуги
      const end = cursor - angleSpan;
      leftSegments.push({
        start: Math.max(end, ARC_START),
        end: cursor,
        color: groupColor(seg.groupKey),
        label: seg.label,
      });
      cursor = end;
    }
  }

  // Правая сторона (0..+100): от 360° до 495° (135° диапазон)
  const rightSegments: Array<{ start: number; end: number; color: string; label: string }> = [];
  if (totalPositive > 0) {
    let cursor = ARC_MID; // 360° (верх, 0)
    for (const seg of positiveSegments) {
      const portion = seg.contribution / totalPositive;
      const angleSpan = portion * 135; // 135° = правая половина дуги
      const end = cursor + angleSpan;
      rightSegments.push({
        start: cursor,
        end: Math.min(end, ARC_END),
        color: groupColor(seg.groupKey),
        label: seg.label,
      });
      cursor = end;
    }
  }

  // ===== Стрелка =====
  const needleAngle = valueToAngle(animatedValue);
  const needleLen = R - STROKE - 10;
  const needleEnd = polar(CX, CY, needleLen, needleAngle);
  const needleBase1 = polar(CX, CY, 8, needleAngle + 90);
  const needleBase2 = polar(CX, CY, 8, needleAngle - 90);

  // ===== Тики и метки =====
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
          aria-label={`Индекс мира: ${displayValue}%`}
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

          {/* Левая сторона: отрицательные сегменты (-100..0) */}
          {leftSegments.map((seg, i) => (
            <motion.path
              key={`left-${i}`}
              d={arcPath(CX, CY, R, seg.start, seg.end)}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.08 }}
            >
              <title>{seg.label}</title>
            </motion.path>
          ))}

          {/* Правая сторона: положительные сегменты (0..+100) */}
          {rightSegments.map((seg, i) => (
            <motion.path
              key={`right-${i}`}
              d={arcPath(CX, CY, R, seg.start, seg.end)}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.08 }}
            >
              <title>{seg.label}</title>
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

          {/* Основные тики и метки */}
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

          {/* Центральная цифра */}
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
            fontSize="14"
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
        {segments
          .filter((s) => Math.abs(s.contribution) > 0.5)
          .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
          .map((seg) => {
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
                  {seg.label}
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

