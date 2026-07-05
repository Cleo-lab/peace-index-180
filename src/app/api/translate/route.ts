import { NextResponse } from "next/server";
import {
  translateMarkerRationale,
  translateAggregateSummary,
} from "@/lib/job";
import { startOfTodayUTC } from "@/lib/analyzer";
import { MARKER_MAP } from "@/lib/markers";

export const dynamic = "force-dynamic";

interface TranslateBody {
  kind: "marker" | "aggregate";
  markerId?: string;
  calcDate?: string; // ISO date
}

/// POST /api/translate — перевод rationale маркера или summary агрегата на русский.
export async function POST(req: Request) {
  let body: TranslateBody;
  try {
    body = (await req.json()) as TranslateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const calcDate = body.calcDate ? new Date(body.calcDate) : startOfTodayUTC();
  if (isNaN(calcDate.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid-date" }, { status: 400 });
  }

  try {
    if (body.kind === "aggregate") {
      const ru = await translateAggregateSummary(calcDate);
      return NextResponse.json({ ok: true, text: ru });
    }
    if (body.kind === "marker") {
      if (!body.markerId) {
        return NextResponse.json(
          { ok: false, error: "markerId-required" },
          { status: 400 },
        );
      }
      // Отсекаем произвольные строки до похода в БД — markerId должен быть
      // одним из 25 реальных маркеров.
      if (!MARKER_MAP[body.markerId]) {
        return NextResponse.json(
          { ok: false, error: "unknown-marker" },
          { status: 400 },
        );
      }
      const ru = await translateMarkerRationale(calcDate, body.markerId);
      return NextResponse.json({ ok: true, text: ru });
    }
    return NextResponse.json(
      { ok: false, error: "unknown-kind" },
      { status: 400 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
