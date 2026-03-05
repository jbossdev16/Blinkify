import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?returnTo=/creative-studio");
  }

  const adminEmails = (process.env.BLINKIFY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isAdmin = user.email && adminEmails.includes(user.email.toLowerCase());

  if (!isAdmin) {
    redirect("/creative-studio");
  }

  return <>{children}</>;
}
