/**
 * One-time script to migrate legislative JSON data into the database.
 * Run with: npx tsx scripts/seed-legislative.ts
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_DIR = path.join(process.cwd(), 'lib', 'legislative', 'data');

async function main() {
  // Get the first team (assumes single-team usage)
  const { data: teams } = await supabase.from('teams').select('id').limit(1);
  if (!teams || teams.length === 0) { console.error('No teams found'); process.exit(1); }
  const teamId = teams[0].id;

  // Seed bills
  const bills = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bills.json'), 'utf-8'));
  for (const b of bills) {
    const { error } = await supabase.from('legislative_bills').upsert({
      team_id: teamId,
      bill_id: b.id,
      bill_id_param: b.billIdParam,
      title: b.title,
      topic: b.topic,
      tier: b.tier,
      house_location: b.houseLocation,
      committee_location: b.committeeLocation,
      committee_hearing_date: b.committeeHearingDate || null,
      last_amended_date: b.lastAmendedDate || null,
      committee_action_date: b.committeeActionDate || null,
      committee_motion: b.committeeMotion || null,
      committee_vote_result: b.committeeVoteResult || null,
      lead_authors: b.leadAuthors || null,
      principal_coauthors: b.principalCoauthors || null,
      coauthors: b.coauthors || null,
      history_actions: b.historyActions || [],
      last_scraped: b.lastScraped || null,
      stages: b.stages || [],
      alert_type: b.alertType || 'none',
      alert_note: b.alertNote || '',
      badge_label: b.badgeLabel || '',
      highlight: b.highlight || 'none',
      policy_deadline: b.policyDeadline || null,
      source_url: b.sourceUrl || null,
    }, { onConflict: 'team_id,bill_id' });
    if (error) console.error(`Bill ${b.id}:`, error.message);
    else console.log(`✓ ${b.id}`);
  }

  // Seed events from dashboard-content.json
  const content = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'dashboard-content.json'), 'utf-8'));
  for (const ev of content.events) {
    const { error } = await supabase.from('legislative_events').insert({
      team_id: teamId,
      title: ev.title,
      description: ev.description,
      event_date: ev.date,
      date_label: ev.dateLabel ? `${ev.dateLabel.month} ${ev.dateLabel.day}` : null,
      urgency: ev.urgency,
      badge_label: ev.badgeLabel || null,
      event_type: 'event',
    });
    if (error) console.error(`Event "${ev.title}":`, error.message);
    else console.log(`✓ Event: ${ev.title}`);
  }

  // Seed calendar milestones
  for (const cal of content.calendar) {
    const dateMatch = cal.date.match(/(\w+ \d+)/);
    const approxDate = dateMatch ? new Date(cal.date.replace(/,?\s*\d{4}$/, ', 2026')) : null;
    const isoDate = approxDate && !isNaN(approxDate.getTime())
      ? approxDate.toISOString().split('T')[0]
      : '2026-01-01';

    const { error } = await supabase.from('legislative_events').insert({
      team_id: teamId,
      title: cal.milestone,
      description: cal.status,
      event_date: isoDate,
      date_label: cal.date,
      urgency: cal.state === 'past' ? 'past' : cal.state === 'imminent' ? 'urgent' : 'future',
      event_type: 'calendar',
    });
    if (error) console.error(`Calendar "${cal.milestone}":`, error.message);
    else console.log(`✓ Calendar: ${cal.milestone}`);
  }

  console.log('\nDone seeding legislative data.');
}

main().catch(console.error);
