import { getTrackedBills, getDashboardContent } from '@/lib/legislative/get-legislative-data';
import LegislativeDashboardClient from './legislative-dashboard-client';

export default async function LegislativePage() {
  const bills = getTrackedBills();
  const content = getDashboardContent();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Legislative Tracker</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">
            Live California bill status, events, and priority actions for FHC&apos;s 2026 legislative campaigns
          </p>
        </div>
      </div>

      <LegislativeDashboardClient bills={bills} content={content} />
    </div>
  );
}
