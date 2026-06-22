"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { probabilityColor } from "@/lib/colors";

interface HistoryPoint {
  date: string;
  probability: number;
  markerCount: number;
}

interface HistoryChartProps {
  points: HistoryPoint[];
  current: number;
}

export function HistoryChart({ points, current }: HistoryChartProps) {
  const [days, setDays] = React.useState<number>(90);

  const filtered = React.useMemo(() => {
    if (points.length === 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return points.filter((p) => new Date(p.date) >= cutoff);
  }, [points, days]);

  const data = filtered.map((p) => ({
    date: p.date,
    probability: p.probability,
  }));

  const color = probabilityColor(current);

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">История индекса</h3>
          <p className="text-xs text-muted-foreground">
            Динамика итоговой вероятности мира во времени
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={String(days)}
          onValueChange={(v) => v && setDays(Number(v))}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="30" className="text-xs">
            30д
          </ToggleGroupItem>
          <ToggleGroupItem value="60" className="text-xs">
            60д
          </ToggleGroupItem>
          <ToggleGroupItem value="90" className="text-xs">
            90д
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
          Недостаточно данных для построения графика. Запустите анализ несколько дней подряд.
        </div>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 4, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }}
                formatter={(v: number) => [`${v}%`, "Вероятность"]}
              />
              <ReferenceLine y={50} stroke="var(--border)" strokeDasharray="2 4" />
              <Line
                type="monotone"
                dataKey="probability"
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
