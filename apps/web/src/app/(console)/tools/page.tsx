"use client";

import { MobileTools } from "@/components/mobile-tools";
import { useWide } from "@/lib/wide";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ToolsPage() {
  const wide = useWide();
  const router = useRouter();
  useEffect(() => {
    if (wide === true) router.replace("/cards");
  }, [wide, router]);
  if (wide !== false) return null;
  return <MobileTools />;
}
