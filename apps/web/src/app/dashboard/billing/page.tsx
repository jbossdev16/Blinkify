import Link from "next/link";
import { getWorkspaces } from "@/lib/api";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Button } from "@/components/ui/button";
import { PLAN_MAX_CREDITS } from "@/lib/constants";
import { TrendingUp, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  let plan = "trial";
  let credits = 0;
  try {
    const { workspaces } = await getWorkspaces();
    const ws = workspaces?.[0];
    if (ws) {
      plan = ws.plan;
      credits = ws.credits;
    }
  } catch {
    // use defaults
  }

  const max = PLAN_MAX_CREDITS[plan.toLowerCase()] ?? 100;
  const used = max - credits;
  const usagePct = max > 0 ? Math.round((used / max) * 100) : 0;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your plan, credits, and payment methods.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Credit usage — prominent */}
        <div className="lg:col-span-2">
          <DashboardCard>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Credit usage
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-3xl font-bold tracking-tight">{credits}</p>
                <p className="text-sm text-muted-foreground">
                  credits left · {plan} plan
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">
                  {used} / {max} used
                </p>
                <p className="text-xs text-muted-foreground">{usagePct}% consumed</p>
              </div>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, usagePct)}%` }}
              />
            </div>
            <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href="/#pricing">Upgrade</Link>
          </Button>
          </DashboardCard>
        </div>

        {/* Next billing cycle */}
        <DashboardCard>
          <div className="flex items-center gap-2.5 mb-4">
            <Calendar className="size-5 text-muted-foreground shrink-0" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Next billing
            </p>
          </div>
          <p className="text-2xl font-bold tracking-tight">—</p>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-default" aria-disabled>
            {plan === "trial" ? "Trial active" : "Billing coming soon"}
          </span>
        </DashboardCard>
      </div>

      {/* Spending analytics */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="size-5 text-muted-foreground" />
          Spending analytics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              This month
            </p>
            <p className="text-2xl font-bold tracking-tight">{used}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-default" aria-disabled>
              Credits used: {used}
            </span>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Last month
            </p>
            <p className="text-2xl font-bold tracking-tight">0</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-default" aria-disabled>
              No usage
            </span>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Avg. daily spend
            </p>
            <p className="text-2xl font-bold tracking-tight">0</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-default" aria-disabled>
              Trial period
            </span>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Forecast
            </p>
            <p className="text-2xl font-bold tracking-tight">—</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-default" aria-disabled>
              Upgrade for usage-based billing
            </span>
          </DashboardCard>
        </div>
      </section>
    </div>
  );
}
