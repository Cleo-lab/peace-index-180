"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { groupColor, probabilityColor, probabilityLabelRu } from "@/lib/colors";
import { cn } from "@/lib/utils";

export interface SegmentDef {
  groupKey: string;
  label: string;
  /// Вклад группы в общую оценку, в процентных пунктах (0-100).
  contribution: number;
  /// Средняя вероятность группы (для тултипа).
  avgProbability: number;
}

interface SpeedometerGaugeProps {
  value: number; // итоговая вероятность 0-100
  segments: SegmentDef[];
  className?: string;
}

// ===== Геометрия спидометра (270° — классическая форма с зазором снизу) =====
// Углы в «компасных» градусах: 0 = верх (12 часов), 90 = право, 180 = низ, 270 = лево.
// 0% → 225° (нижне-лево, ~7-8 часов)
// 50% → 0° (верх, 12 часов)
// 100% → 135° (нижне-право, ~4-5 часов)
const CX = 160;
const CY = 155;
const R = 112;
const STROKE = 22;
const START_ANGLE = 225;
const SWEEP = 270;
const VIEW_W = 320;
// viewBox начинается с Y=-12, чтобы дать место для метки "50" сверху
const VIEW_BOX = "0 -12 320 292";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function valueToAngle(v: number): number {
  return START_ANGLE + (v / 100) * SWEEP;
}

function arcPath(cx: number, cy: number, r: number, v1: number, v2: number): string {
  const a1 = valueToAngle(v1);
  const a2 = valueToAngle(v2);
  const p1 = polar(cx, cy, r, a1);
  const p2 = polar(cx, cy, r, a2);
  const largeArc = a2 - a1 > 180 ? 1 : 0;
  // sweep=1 — по часовой стрелке в SVG (y вниз)
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
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

export function SpeedometerGauge({
  value,
  segments,
  className,
}: SpeedometerGaugeProps) {
  const v = Math.max(0, Math.min(100, value));
  const animatedValue = useCountUp(v);
  const displayValue = Math.round(animatedValue);
  const totalColor = probabilityColor(v);

  // Нормируем вклады к итогу
  const sumContrib = segments.reduce((s, x) => s + x.contribution, 0) || 1;
  const normalized = segments.map((s) => ({
    ...s,
    scaled: (s.contribution / sumContrib) * v,
  }));

  // Кумулятивные границы сегментов
  const { list: segmentBounds } = normalized.reduce(
    (acc, s) => {
      const start = acc.cursor;
      const end = acc.cursor + s.scaled;
      acc.cursor = end;
      acc.list.push({ ...s, start, end });
      return acc;
    },
    {
      cursor: 0,
      list: [] as Array<(typeof normalized)[number] & { start: number; end: number }>,
    },
  );

  // Стрелка
  const needleAngle = valueToAngle(animatedValue);
  const needleLen = R - STROKE - 14;
  const needleEnd = polar(CX, CY, needleLen, needleAngle);
  const needleBase1 = polar(CX, CY, 9, needleAngle + 90);
  const needleBase2 = polar(CX, CY, 9, needleAngle - 90);

  // Тики шкалы
  const allTicks = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
  const majorTicks = [0, 25, 50, 75, 100];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-full max-w-[360px]">
        <svg
          viewBox={VIEW_BOX}
          className="w-full"
          role="img"
          aria-label={`Спидометр вероятности мира: ${v} процентов. Цветные сегменты показывают вклад групп маркеров.`}
        >
          {/* Фоновая шкала: полная дуга 0–100 (видимая серая дорожка) */}
          <path
            d={arcPath(CX, CY, R, 0, 100)}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="butt"
            className="text-muted-foreground"
            opacity={0.18}
          />

          {/* Цветные сегменты-вклады */}
          {segmentBounds.map((seg, i) => {
            if (seg.end - seg.start < 0.05) return null;
            const color = groupColor(seg.groupKey);
            return (
              <motion.path
                key={seg.groupKey}
                d={arcPath(CX, CY, R, seg.start, seg.end)}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: 0.55,
                  delay: 0.15 + i * 0.07,
                  ease: "easeOut",
                }}
              >
                <title>
                  {seg.label}: вклад {seg.contribution.toFixed(1)}% (средняя
                  вероятность {Math.round(seg.avgProbability)}%)
                </title>
              </motion.path>
            );
          })}

          {/* Тики шкалы */}
          {allTicks.map((tick) => {
            const a = valueToAngle(tick);
            const isMajor = majorTicks.includes(tick);
            const tickLen = isMajor ? 9 : 4;
            const p1 = polar(CX, CY, R + STROKE / 2 + 1, a);
            const p2 = polar(CX, CY, R + STROKE / 2 + 1 + tickLen, a);
            return (
              <line
                key={tick}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="var(--muted-foreground)"
                strokeWidth={isMajor ? 2 : 1}
                opacity={isMajor ? 0.7 : 0.35}
              />
            );
          })}

          {/* Числовые метки шкалы */}
          {majorTicks.map((tick) => {
            const a = valueToAngle(tick);
            const p = polar(CX, CY, R + STROKE / 2 + 16, a);
            return (
              <text
                key={tick}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fill="var(--muted-foreground)"
                fontWeight={600}
              >
                {tick}
              </text>
            );
          })}

          {/* Стрелка-указатель */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <polygon
              points={`${needleBase1.x.toFixed(2)},${needleBase1.y.toFixed(2)} ${needleBase2.x.toFixed(2)},${needleBase2.y.toFixed(2)} ${needleEnd.x.toFixed(2)},${needleEnd.y.toFixed(2)}`}
              fill={totalColor}
              style={{
                filter: `drop-shadow(0 0 4px color-mix(in oklch, ${totalColor} 50%, transparent))`,
              }}
            />
            {/* Центральный пин */}
            <circle cx={CX} cy={CY} r={13} fill={totalColor} />
            <circle cx={CX} cy={CY} r={5} fill="var(--background)" />
          </motion.g>

          {/* Центральная подпись — в зазоре снизу, под основанием стрелки */}
          <text
            x={CX}
            y={CY + 52}
            textAnchor="middle"
            fontSize="38"
            fontWeight="700"
            fill={totalColor}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {displayValue}
            <tspan fontSize="22" dy="-4" opacity={0.6}>
              %
            </tspan>
          </text>
          <text
            x={CX}
            y={CY + 72}
            textAnchor="middle"
            fontSize="11"
            fill="var(--muted-foreground)"
            fontWeight={500}
          >
            вероятность мира
          </text>
        </svg>
      </div>

      {/* Тир вероятности */}
      <span
        className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
        style={{
          color: totalColor,
          backgroundColor: `color-mix(in oklch, ${totalColor} 14%, transparent)`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: totalColor }}
        />
        {probabilityLabelRu(v)} вероятность
      </span>

      {/* Легенда вкладов групп */}
      <div className="mt-4 w-full max-w-[360px] space-y-1.5">
        {segmentBounds.map((seg) => {
          const color = groupColor(seg.groupKey);
          const shareOfTotal = v > 0 ? (seg.contribution / v) * 100 : 0;
          return (
            <div
              key={seg.groupKey}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="flex-1 leading-tight text-muted-foreground">
                {seg.label}
              </span>
              <span
                className="font-mono font-semibold tabular-nums"
                style={{ color }}
              >
                +{seg.contribution.toFixed(1)}
              </span>
              <span className="w-10 text-right text-[10px] text-muted-foreground">
                {Math.round(shareOfTotal)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
