import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/profile?tab=settings");
}
