import { getWorkspaces } from "@/lib/api";
import { PLAN_MAX_CREDITS } from "@/lib/constants";
import { TrendingUp, Coins } from "lucide-react";
import { BillingSpendingChart } from "@/components/dashboard/billing-spending-chart";
import { BillingCreditUsageCard } from "@/components/dashboard/billing-credit-usage-card";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  let plan = "trial";
  let credits = 0;
  let workspaces: { id: string; plan: string; credits: number }[] | null = null;
  try {
    const res = await getWorkspaces();
    workspaces = res.workspaces ?? null;
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
  const workspaceId = workspaces?.[0]?.id ?? null;

  return (
    <div className="p-6 lg:p-10">
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Coins className="size-5 shrink-0" style={{ color: "#007aff" }} />
          Credit usage
        </h2>
        <BillingCreditUsageCard
          credits={credits}
          plan={plan}
          used={used}
          max={max}
          usagePct={usagePct}
        />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="size-5 shrink-0" style={{ color: "#007aff" }} />
          Spending analytics
        </h2>
        <BillingSpendingChart used={used} plan={plan} workspaceId={workspaceId} />
      </section>
    </div>
  );
}
