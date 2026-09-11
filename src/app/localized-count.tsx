"use client";

import { useSyncExternalStore } from "react";

interface LocalizedCountProps {
  value: number;
}

export function LocalizedCount({ value }: LocalizedCountProps) {
  const formatted = useSyncExternalStore(
    () => () => {},
    () => new Intl.NumberFormat().format(value),
    () => String(value),
  );

  return formatted;
}
