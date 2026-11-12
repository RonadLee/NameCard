"use client";

import { CardEditor } from "@/components/card-editor";
import { useParams } from "next/navigation";

export default function EditCardPage() {
  const params = useParams<{ id: string }>();
  return <CardEditor id={params.id} />;
}
