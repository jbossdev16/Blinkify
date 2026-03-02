import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Redirect "New project" to Brand page (create flow shown when no brand yet). */
export default function NewProjectPage() {
  redirect("/dashboard/brand");
}
