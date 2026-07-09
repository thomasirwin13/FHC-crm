const CFMS_BASE = 'https://cityclerk.lacity.org/lacityclerkconnect/index.cfm';

export async function fetchCouncilFile(cfNumber: string) {
  const normalized = cfNumber.trim().replace(/^CF\s*/i, '');

  const res = await fetch(`${CFMS_BASE}?fa=ccfi.viewrecord&cfnumber=${encodeURIComponent(normalized)}`, {
    headers: { 'User-Agent': 'HousingAdvocacyCRM/1.0' },
  });

  if (!res.ok) {
    throw new Error(`LA City Clerk error ${res.status}`);
  }

  const html = await res.text();

  if (html.includes('No records found') || !html.includes('Council File:')) {
    return null;
  }

  return parseCouncilFilePage(html, normalized);
}

function extractField(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const pattern = new RegExp(
    'reclabel">' + escaped + '</div>[\\s\\S]*?<div class="rectext">([^<]+)</div>',
    'i'
  );
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

function parseCouncilFilePage(html: string, cfNumber: string) {
  const title = extractField(html, 'Title');
  const dateIntroduced = extractField(html, 'Date Received / Introduced');
  const lastChanged = extractField(html, 'Last Changed Date');
  const expirationDate = extractField(html, 'Expiration Date');

  // Mover and Second have slightly different HTML structure
  const moverMatch = html.match(/<div class="reclabel">Mover<\/div>\s*<div class="rectext">\s*([\s\S]*?)<\/div>/i);
  const mover = moverMatch ? moverMatch[1].replace(/<[^>]*>/g, '').trim() : null;

  const secondMatch = html.match(/<div class="reclabel">Second<\/div>\s*<div class="rectext">\s*([\s\S]*?)<\/div>/i);
  const second = secondMatch ? secondMatch[1].replace(/<[^>]*>/g, '').trim() : null;

  // Extract file activities table
  const activitiesMatch = html.match(/File Activities<\/div>\s*<div class="rectext[^"]*">([\s\S]*?)<\/table>/i);
  const activities: { date: string; action: string }[] = [];

  if (activitiesMatch) {
    const rows = activitiesMatch[1].matchAll(
      /<tr class="rowcolor\d+">\s*<td class="ViewRecordHistory">(\d{2}\/\d{2}\/\d{4})<\/td>\s*<td class="ViewRecordHistory">\s*([\s\S]*?)\s*<\/td>/gi
    );
    for (const row of rows) {
      const date = row[1];
      const action = row[2].replace(/<[^>]*>/g, '').trim();
      if (date && action) {
        activities.push({
          date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit',
          }),
          action,
        });
      }
    }
  }

  // Derive simple stages for council files
  const hasCommitteeAction = activities.some(a =>
    /committee/i.test(a.action) && !/community impact/i.test(a.action)
  );
  const adoptedOrApproved = activities.some(a =>
    /\b(adopted|approved|passed)\b/i.test(a.action)
  );
  const mayorAction = activities.some(a =>
    /\bmayor\b/i.test(a.action)
  );

  const stages = [
    { label: 'Introduced', status: 'done' as string },
    { label: 'Committee', status: hasCommitteeAction ? 'done' : 'active' },
    { label: 'Council Vote', status: adoptedOrApproved ? 'done' : 'future' },
    { label: 'Mayor', status: mayorAction ? 'done' : 'future' },
  ];

  const sourceUrl = `${CFMS_BASE}?fa=ccfi.viewrecord&cfnumber=${encodeURIComponent(cfNumber)}`;

  // Build authors from mover/second
  const authorParts = [mover, second].filter(Boolean);
  const leadAuthors = authorParts.length > 0 ? authorParts.join(', ') : null;

  return {
    title: title || `Council File ${cfNumber}`,
    house_location: 'LA City Council',
    committee_location: null as string | null,
    lead_authors: leadAuthors,
    principal_coauthors: null as string | null,
    coauthors: null as string | null,
    history_actions: activities.slice(0, 10),
    stages,
    last_scraped: new Date().toISOString(),
    source_url: sourceUrl,
  };
}
