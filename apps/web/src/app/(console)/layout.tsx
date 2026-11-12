"use client";

import { Shell } from "@/components/shell";
import { useSession } from "@/lib/store";
import { useHydratedSession } from "../providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const ready = useHydratedSession();
  const token = useSession((state) => state.accessToken);
  const router = useRouter();
  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);
  if (!ready || !token) return <div className="grid h-screen place-items-center text-sm text-[#8b919a]">Loading workspace…</div>;
  return <Shell>{children}</Shell>;
}
