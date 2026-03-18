"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Shield, Users, Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

const VALID_PLANS = ["free", "trial", "standard", "pro", "agency", "enterprise"];

interface AdminWorkspace {
  id: string;
  name: string;
  plan: string;
  credits: number;
  max_workspaces: number;
  slug: string | null;
  owner_email: string | null;
  owner_name: string | null;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  created_at: string;
}

async function getToken() {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
  return body as T;
}

export default function AdminPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wsRes, usersRes] = await Promise.all([
        adminFetch<{ workspaces: AdminWorkspace[] }>("/admin/workspaces"),
        adminFetch<{ users: AdminUser[] }>("/admin/users"),
      ]);
      setWorkspaces(wsRes.workspaces);
      setUsers(usersRes.users);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handlePlanChange(workspaceId: string, newPlan: string) {
    setChangingPlan(workspaceId);
    setError(null);
    try {
      const { workspace } = await adminFetch<{ workspace: AdminWorkspace }>(`/admin/workspaces/${workspaceId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan: newPlan }),
      });
      setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? { ...w, plan: workspace.plan, credits: workspace.credits, max_workspaces: workspace.max_workspaces } : w)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change plan");
    } finally {
      setChangingPlan(null);
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="size-7 text-primary" />
            Admin
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage workspaces, plans, and users.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Workspaces */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="size-5 text-muted-foreground" />
          Workspaces
          <span className="text-sm font-normal text-muted-foreground">({workspaces.length})</span>
        </h2>
        <DashboardCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Workspace</th>
                  <th className="pb-3 pr-4 font-medium">Owner</th>
                  <th className="pb-3 pr-4 font-medium">Plan</th>
                  <th className="pb-3 pr-4 font-medium">Credits</th>
                  <th className="pb-3 pr-4 font-medium">Created</th>
                  <th className="pb-3 font-medium">Change Plan</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {!loading && workspaces.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No workspaces found.</td></tr>
                )}
                {workspaces.map((ws) => (
                  <tr key={ws.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium">{ws.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{ws.owner_email ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                        {ws.plan}
                      </span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{ws.credits}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{new Date(ws.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      <select
                        value={ws.plan}
                        onChange={(e) => handlePlanChange(ws.id, e.target.value)}
                        disabled={changingPlan === ws.id}
                        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                      >
                        {VALID_PLANS.map((p) => (
                          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" />
          Users
          <span className="text-sm font-normal text-muted-foreground">({users.length})</span>
        </h2>
        <DashboardCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Email</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No users found.</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium">{u.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {u.is_super_admin ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          Admin
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">User</span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </section>
    </div>
  );
}
