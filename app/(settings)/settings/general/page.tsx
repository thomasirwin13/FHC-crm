import { getTeamForUser, getContactsForTeam, getCategoriesForTeam } from '@/lib/db/supabase-queries';
import { resolveRegions } from '@/lib/integrations';
import AccountForm from './account-form';
import RegionsEditor from './regions-editor';
import TagsEditor from './tags-editor';
import DangerZone from './danger-zone';

export default async function GeneralPage() {
  const team = await getTeamForUser();
  const [regions, contacts, categories] = await Promise.all([
    team ? resolveRegions(team.id) : [],
    team ? getContactsForTeam(team.id) : [],
    team ? getCategoriesForTeam(team.id) : [],
  ]);

  return (
    <section className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-10 text-foreground">
        General settings
      </h1>

      <AccountForm />
      <RegionsEditor initialRegions={regions} />
      <TagsEditor initialCategories={categories as any[]} />
      <DangerZone contactCount={(contacts as any[]).length} />
    </section>
  );
}
