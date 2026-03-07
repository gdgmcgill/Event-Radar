"use client";

import { use } from "react";
import { ClubDashboard } from "@/components/clubs/ClubDashboard";

export default function MyClubDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <ClubDashboard clubId={id} />;
}
