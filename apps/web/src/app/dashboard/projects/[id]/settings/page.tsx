import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Redirect legacy project settings to Brand page (single brand per account). */
export default function ProjectSettingsPage() {
  redirect("/dashboard/brand");
}
