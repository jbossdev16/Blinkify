import { SettingsContentSections } from "@/components/dashboard/settings-modal";

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your preferences and account.
        </p>
      </div>
      <SettingsContentSections />
    </div>
  );
}
