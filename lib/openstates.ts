const API_BASE = 'https://v3.openstates.org';

function getApiKey(): string {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) throw new Error('OPENSTATES_API_KEY not set');
  return key;
}

type Sponsorship = {
  name: string;
  person: { name: string } | null;
  primary: boolean;
  classification: string;
};

type Action = {
  description: string;
  date: string;
  organization: { name: string; classification: string };
  classification: string[];
  order: number;
};

type Source = {
  url: string;
  note: string;
};

export type OpenStatesBill = {
  identifier: string;
  title: string;
  from_organization: { name: string; classification: string };
  latest_action_date: string | null;
  latest_action_description: string | null;
  latest_passage_date: string | null;
  openstates_url: string;
  sponsorships: Sponsorship[];
  actions: Action[];
  sources: Source[];
  subject: string[];
};

const JURISDICTION_MAP: Record<string, string> = {
  california: 'ca',
  ca: 'ca',
};

export function isConfigured(): boolean {
  return !!process.env.OPENSTATES_API_KEY;
}

export async function fetchBill(
  billIdentifier: string,
  jurisdiction: string = 'ca',
): Promise<OpenStatesBill | null> {
  const jur = JURISDICTION_MAP[jurisdiction.toLowerCase()] || jurisdiction.toLowerCase();

  const normalized = billIdentifier
    .toUpperCase()
    .replace(/[.\-]/g, '')
    .replace(/([A-Z]+)\s*(\d+)/, '$1 $2');

  const params = new URLSearchParams({
    jurisdiction: jur,
    identifier: normalized,
    include: 'sponsorships',
  });
  params.append('include', 'actions');
  params.append('include', 'sources');

  const res = await fetch(`${API_BASE}/bills?${params}`, {
    headers: { 'X-API-KEY': getApiKey() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Open States API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  return data.results[0] as OpenStatesBill;
}

export function extractBillData(bill: OpenStatesBill) {
  const authors = bill.sponsorships.filter(s => s.primary && s.classification === 'author');
  const principalCoauthors = bill.sponsorships.filter(s => !s.primary && s.classification === 'principal coauthor');
  const coauthors = bill.sponsorships.filter(s => !s.primary && (s.classification === 'coauthor' || s.classification === 'cosponsor'));

  const nameList = (list: Sponsorship[]) =>
    list.map(s => s.person?.name || s.name).join(', ');

  const sortedActions = [...bill.actions].sort((a, b) => b.order - a.order);

  const historyActions = sortedActions.slice(0, 10).map(a => ({
    date: new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    }),
    action: a.description,
  }));

  const currentChamber = sortedActions[0]?.organization.name || bill.from_organization.name;

  const lastCommitteeRef = sortedActions.find(a =>
    a.classification.includes('referral-committee')
  );
  const committeeMatch = lastCommitteeRef?.description.match(/Com\. on ([A-Z.& ]+)/);
  const committee = committeeMatch ? committeeMatch[1].replace(/\.$/, '') : null;

  const originChamber = bill.from_organization.name;
  const secondChamber = originChamber === 'Assembly' ? 'Senate' : 'Assembly';
  const abbrev = (ch: string) => ch === 'Assembly' ? 'Asm.' : 'Sen.';

  function extractVote(desc: string): string {
    const m = desc.match(/\(Ayes (\d+)[.,]\s*Noes (\d+)/);
    return m ? ` (${m[1]}-${m[2]})` : '';
  }

  // Floor passage votes per chamber
  const floorPassages = bill.actions.filter(a => a.classification.includes('passage'));
  const originFloorVote = floorPassages.find(a => a.organization.name === originChamber);
  const secondFloorVote = floorPassages.find(a => a.organization.name === secondChamber);

  const passedFirstChamber = !!originFloorVote;
  const passedSecondChamber = !!secondFloorVote;

  // Last committee passage per chamber (for vote counts on committee stages)
  const committeePassages = bill.actions.filter(a =>
    a.classification.includes('committee-passage') || a.classification.includes('committee-passage-favorable')
  );
  const originCommitteeVotes = committeePassages.filter(a => a.organization.name === originChamber);
  const secondCommitteeVotes = committeePassages.filter(a => a.organization.name === secondChamber);
  const lastOriginCommVote = originCommitteeVotes.length > 0
    ? originCommitteeVotes.sort((a, b) => b.order - a.order)[0] : null;
  const lastSecondCommVote = secondCommitteeVotes.length > 0
    ? secondCommitteeVotes.sort((a, b) => b.order - a.order)[0] : null;

  // Committee names per chamber from referrals
  const originCommitteeRef = [...sortedActions].find(a =>
    a.classification.includes('referral-committee') && a.organization.name === originChamber
  );
  const secondCommitteeRef = [...sortedActions].find(a =>
    a.classification.includes('referral-committee') && a.organization.name === secondChamber
  );
  const extractCommittee = (desc?: string) => {
    if (!desc) return null;
    const m = desc.match(/Com\. on ([A-Z.& ]+)/);
    return m ? m[1].replace(/\.$/, '').trim() : null;
  };
  const originCommName = extractCommittee(originCommitteeRef?.description);
  const secondCommName = extractCommittee(secondCommitteeRef?.description);

  const stages: { label: string; status: string }[] = [];

  stages.push({
    label: `${abbrev(originChamber)} ${originCommName || 'Committee'}${lastOriginCommVote ? extractVote(lastOriginCommVote.description) : ''}`,
    status: passedFirstChamber ? 'done' : (originCommName ? 'active' : 'future'),
  });
  stages.push({
    label: `${abbrev(originChamber)} Floor${originFloorVote ? extractVote(originFloorVote.description) : ''}`,
    status: passedFirstChamber ? 'done' : 'future',
  });
  stages.push({
    label: `${abbrev(secondChamber)} ${secondCommName || 'Committee'}${lastSecondCommVote ? extractVote(lastSecondCommVote.description) : ''}`,
    status: passedFirstChamber
      ? (passedSecondChamber ? 'done' : (secondCommName ? 'active' : 'future'))
      : 'future',
  });
  stages.push({
    label: `${abbrev(secondChamber)} Floor${secondFloorVote ? extractVote(secondFloorVote.description) : ''}`,
    status: passedSecondChamber ? 'done' : 'future',
  });
  stages.push({
    label: 'Governor',
    status: 'future',
  });

  const legInfoUrl = bill.sources?.find(s => s.url.includes('leginfo'))?.url
    || `https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260${bill.identifier.replace(' ', '')}`;

  return {
    title: bill.title,
    house_location: currentChamber,
    committee_location: committee,
    lead_authors: nameList(authors) || null,
    principal_coauthors: nameList(principalCoauthors) || null,
    coauthors: nameList(coauthors) || null,
    history_actions: historyActions,
    stages,
    last_scraped: new Date().toISOString(),
    source_url: legInfoUrl,
    latest_action_date: bill.latest_action_date,
    latest_action_description: bill.latest_action_description,
  };
}
