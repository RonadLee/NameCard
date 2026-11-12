"use client";

import { useHydratedSession } from "./providers";
import { useSession } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const ready = useHydratedSession();
  const token = useSession((state) => state.accessToken);
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    router.replace(token ? "/cards" : "/login");
  }, [ready, token, router]);
  return <div className="grid h-screen place-items-center text-sm text-[#8b919a]">Opening NameCard…</div>;
}
