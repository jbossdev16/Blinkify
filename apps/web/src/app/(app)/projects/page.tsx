import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Redirect legacy Projects list to Brand page (single brand per account). */
export default function ProjectsPage() {
  redirect("/brand");
}
