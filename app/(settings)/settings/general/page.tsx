import { getTeamForUser } from '@/lib/db/supabase-queries';
import { resolveRegions } from '@/lib/integrations';
import AccountForm from './account-form';
import RegionsEditor from './regions-editor';

export default async function GeneralPage() {
  const team = await getTeamForUser();
  const regions = team ? await resolveRegions(team.id) : [];

  return (
    <section className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-10 text-foreground">
        General settings
      </h1>

      <AccountForm />
      <RegionsEditor initialRegions={regions} />
    </section>
  );
}
