"use client";

import * as React from "react";
import { useLanguage } from "@/components/peace/language-context";

export function Disclaimer() {
  const { tx } = useLanguage();
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      {tx("disclaimerText")}
    </p>
  );
}
