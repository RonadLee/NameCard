"use client";

import { CardForm } from "@/components/card-form";
import { useParams } from "next/navigation";

export default function EditCardPage() {
  const params = useParams<{ id: string }>();
  return <CardForm contactId={params.id} />;
}