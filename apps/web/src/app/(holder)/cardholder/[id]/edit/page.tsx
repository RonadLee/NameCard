"use client";

import { CardForm } from "@/components/card-form";
import { useParams } from "next/navigation";

export default function EditCardPage() {
  const params = useParams<{ id: string }>();
  return <div className="h-full min-h-0 flex-1 overflow-y-auto p-4"><CardForm contactId={params.id} /></div>;
}