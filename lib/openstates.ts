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

  const passedFirstChamber = bill.actions.some(a => a.classification.includes('passage'));
  const passedSecondChamber = bill.actions.filter(a => a.classification.includes('passage')).length >= 2;

  const stages: { label: string; status: string }[] = [];
  const originChamber = bill.from_organization.name;
  const secondChamber = originChamber === 'Assembly' ? 'Senate' : 'Assembly';

  stages.push({
    label: `${originChamber} Committee`,
    status: passedFirstChamber ? 'done' : (committee ? 'active' : 'future'),
  });
  stages.push({
    label: `${originChamber} Floor`,
    status: passedFirstChamber ? 'done' : 'future',
  });
  stages.push({
    label: `${secondChamber} Committee`,
    status: passedFirstChamber
      ? (passedSecondChamber ? 'done' : (committee ? 'active' : 'future'))
      : 'future',
  });
  stages.push({
    label: `${secondChamber} Floor`,
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
