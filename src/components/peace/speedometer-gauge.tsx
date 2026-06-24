"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { groupColor, probabilityColor, probabilityLabelRu } from "@/lib/colors";
import { cn } from "@/lib/utils";

export interface SegmentDef {
  groupKey: string;
  label: string;
  /// Вклад группы в общую оценку, в процентных пунктах (-100..+100).
  contribution: number;
  /// Средняя вероятность группы (для тултипа).
  avgProbability: number;
}

interface SpeedometerGaugeProps {
  value: number; // итоговая оценка -100..+100
  segments: SegmentDef[];
  className?: string;
  /// Режим отображения: полукруг (классика) или полный круг (360°).
  mode?: "semicircle" | "circular";
}

// ===== Геометрия =====
const CX = 160;
const CY = 160;
const R = 108;
const STROKE = 20;
const VIEW_W = 320;
const VIEW_H = 320;

// Полукруг: 270° с зазором снизу. 0% → 225°, 50% → 0° (верх), 100% → 135°
const SEMI_START_ANGLE = 225;
const SEMI_SWEEP = 270;

// Круг: полный 360°. -100% → 0° (верх), 0% → 180° (низ), +100% → 360° (верх)
const CIRC_START_ANGLE = 0;
const CIRC_SWEEP = 360;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function valueToAngle(v: number, mode: "semicircle" | "circular"): number {
  if (mode === "circular") {
    // -100..+100 → 0°..360°
    const normalized = Math.max(-100, Math.min(100, v));
    return CIRC_START_ANGLE + ((normalized + 100) / 200) * CIRC_SWEEP;
  }
  // semicircle: 0..100 → 225°..135° (через 0° сверху)
  const normalized = Math.max(0, Math.min(100, v));
  return SEMI_START_ANGLE + (normalized / 100) * SEMI_SWEEP;
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  a1: number,
  a2: number
): string {
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

export function SpeedometerGauge({
  value,
  segments,
  className,
  mode = "semicircle",
}: SpeedometerGaugeProps) {
  const isCircular = mode === "circular";
  const clampedValue = isCircular
    ? Math.max(-100, Math.min(100, value))
    : Math.max(0, Math.min(100, value));

  const animatedValue = useCountUp(clampedValue);
  const displayValue = Math.round(animatedValue);
  const totalColor = probabilityColor(clampedValue);

  // ===== Нормализация сегментов =====
  // Для кругового режима: contribution может быть отрицательным.
  // Суммируем абсолютные вклады для пропорций дуги.
  const sumAbsContrib =
    segments.reduce((s, x) => s + Math.abs(x.contribution), 0) || 1;
  const normalized = segments.map((s) => ({
    ...s,
    scaled: (Math.abs(s.contribution) / sumAbsContrib) * 200, // 200 = полный круг в "условных %" для дуги
  }));

  // Кумулятивные границы сегментов (в градусах для кругового, в 0..100 для полукруга)
  const { list: segmentBounds } = normalized.reduce(
    (acc, s) => {
      const start = acc.cursor;
      const end = acc.cursor + s.scaled;
      acc.cursor = end;
      acc.list.push({ ...s, start, end });
      return acc;
    },
    {
      cursor: isCircular ? 0 : 0,
      list: [] as Array<
        (typeof normalized)[number] & { start: number; end: number }
      >,
    }
  );

  // ===== Стрелка =====
  const needleAngle = valueToAngle(animatedValue, mode);
  const needleLen = R - STROKE - 14;
  const needleEnd = polar(CX, CY, needleLen, needleAngle);
  const needleBase1 = polar(CX, CY, 9, needleAngle + 90);
  const needleBase2 = polar(CX, CY, 9, needleAngle - 90);

  // ===== Тики и метки =====
  const circTicks = [-100, -75, -50, -25, 0, 25, 50, 75, 100];
  const circMajorTicks = [-100, -50, 0, 50, 100];
  const semiTicks = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
  const semiMajorTicks = [0, 25, 50, 75, 100];

  const allTicks = isCircular ? circTicks : semiTicks;
  const majorTicks = isCircular ? circMajorTicks : semiMajorTicks;

  // ===== viewBox =====
  const viewBox = isCircular
    ? `0 0 ${VIEW_W} ${VIEW_H}`
    : "0 -12 320 292";

  // ===== Подпись центра =====
  const centerLabel = isCircular ? "динамика мира/войны" : "вероятность мира";
  const formattedDisplay = isCircular
    ? `${displayValue > 0 ? "+" : ""}${displayValue}`
    : `${displayValue}`;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-full max-w-[360px]">
        <svg
          viewBox={viewBox}
          className="w-full"
          role="img"
          aria-label={
            isCircular
              ? `Круговой индикатор мира/войны: ${clampedValue}%. Цветные сегменты показывают вклад групп маркеров.`
              : `Спидометр вероятности мира: ${clampedValue} процентов. Цветные сегменты показывают вклад групп маркеров.`
          }
        >
          {/* Фоновая дорожка */}
          {isCircular ? (
            // Полный круг — фоновая окружность
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              className="text-muted-foreground"
              opacity={0.12}
            />
          ) : (
            // Полукруг — дуга
            <path
              d={arcPath(CX, CY, R, SEMI_START_ANGLE, SEMI_START_ANGLE + SEMI_SWEEP)}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeLinecap="butt"
              className="text-muted-foreground"
              opacity={0.18}
            />
          )}

          {/* Цветные сегменты-вклады */}
          {segmentBounds.map((seg, i) => {
            if (seg.end - seg.start < 0.5) return null;
            const color = groupColor(seg.groupKey);

            let d: string;
            if (isCircular) {
              // Круговой: start/end в градусах
              d = arcPath(CX, CY, R, seg.start, seg.end);
            } else {
              // Полукруг: start/end в 0..100
              const a1 = SEMI_START_ANGLE + (seg.start / 100) * SEMI_SWEEP;
              const a2 = SEMI_START_ANGLE + (seg.end / 100) * SEMI_SWEEP;
              d = arcPath(CX, CY, R, a1, a2);
            }

            return (
              <motion.path
                key={seg.groupKey}
                d={d}
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
                  {seg.label}: вклад {seg.contribution > 0 ? "+" : ""}
                  {seg.contribution.toFixed(1)} (средняя оценка{" "}
                  {Math.round(seg.avgProbability)})
                </title>
              </motion.path>
            );
          })}

          {/* Тики шкалы */}
          {allTicks.map((tick) => {
            const a = valueToAngle(tick, mode);
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
            const a = valueToAngle(tick, mode);
            const labelOffset = isCircular && (tick === -100 || tick === 100) ? 20 : 16;
            const p = polar(CX, CY, R + STROKE / 2 + labelOffset, a);
            const label = isCircular && tick > 0 ? `+${tick}` : `${tick}`;
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
                {label}
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

          {/* Центральная подпись */}
          <text
            x={CX}
            y={CY + 50}
            textAnchor="middle"
            fontSize="36"
            fontWeight="700"
            fill={totalColor}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formattedDisplay}
            <tspan fontSize="20" dy="-4" opacity={0.6}>
              %
            </tspan>
          </text>
          <text
            x={CX}
            y={CY + 68}
            textAnchor="middle"
            fontSize="11"
            fill="var(--muted-foreground)"
            fontWeight={500}
          >
            {centerLabel}
          </text>
        </svg>
      </div>

      {/* Тир вероятности */}
      <span
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
        style={{
          color: totalColor,
          backgroundColor: `color-mix(in oklch, ${totalColor} 14%, transparent)`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: totalColor }}
        />
        {probabilityLabelRu(clampedValue)}
      </span>

      {/* Легенда вкладов групп */}
      <div className="mt-4 w-full max-w-[360px] space-y-1.5">
        {segmentBounds.map((seg) => {
          const color = groupColor(seg.groupKey);
          const totalAbs = segments.reduce((s, x) => s + Math.abs(x.contribution), 0) || 1;
          const shareOfTotal = (Math.abs(seg.contribution) / totalAbs) * 100;
          const sign = seg.contribution > 0 ? "+" : "";
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
                {sign}
                {seg.contribution.toFixed(1)}
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
