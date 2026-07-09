import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBill, extractBillData, isConfigured } from '@/lib/openstates';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: 'OPENSTATES_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: bills } = await (supabase as any)
    .from('legislative_bills')
    .select('id, bill_id, team_id');

  if (!bills || bills.length === 0) {
    return NextResponse.json({ refreshed: 0, message: 'No bills to refresh' });
  }

  let refreshed = 0;
  const errors: string[] = [];

  for (const bill of bills) {
    try {
      const apiBill = await fetchBill(bill.bill_id, 'ca');
      if (!apiBill) {
        errors.push(`${bill.bill_id}: not found`);
        continue;
      }
      const scraped = extractBillData(apiBill);
      await (supabase as any)
        .from('legislative_bills')
        .update({
          title: scraped.title,
          house_location: scraped.house_location,
          committee_location: scraped.committee_location,
          lead_authors: scraped.lead_authors,
          principal_coauthors: scraped.principal_coauthors,
          coauthors: scraped.coauthors,
          history_actions: scraped.history_actions,
          stages: scraped.stages,
          source_url: scraped.source_url,
          last_scraped: scraped.last_scraped,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bill.id)
        .eq('team_id', bill.team_id);
      refreshed++;
    } catch (e: any) {
      errors.push(`${bill.bill_id}: ${e.message}`);
    }
  }

  return NextResponse.json({
    refreshed,
    total: bills.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
