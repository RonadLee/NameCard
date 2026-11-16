"use client";

import { useLayoutEffect, useState } from "react";

const desktop = "(min-width: 1366px)";

export function useWide() {
  const [wide, setWide] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    const media = window.matchMedia(desktop);
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return wide;
}
