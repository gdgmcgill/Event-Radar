import { redirect } from "next/navigation";

/**
 * /my-events now lives at /calendar?view=List
 * This page redirects for backwards compatibility.
 */
export default function MyEventsPage() {
  redirect("/calendar?view=Saved");
}
