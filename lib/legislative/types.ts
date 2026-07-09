// Types for the FHC state-legislative bill tracker & dashboard.
// Data is stored as JSON under lib/legislative/data/ and refreshed by
// scripts/refresh-legislative-bills.ts (leginfo.legislature.ca.gov, via Playwright).

export type StageStatus = 'done' | 'active' | 'active-today' | 'floor-now' | 'future' | 'canceled';

export interface BillStage {
  label: string;
  status: StageStatus;
}

export interface BillHistoryAction {
  date: string; // MM/DD/YY as shown on leginfo
  action: string;
}

export type BillAlertType = 'floor' | 'good' | 'today' | 'canceled' | 'none';

/**
 * A single tracked bill. Fields are split into two groups:
 *  - Scraped fields (houseLocation, committeeLocation, committeeHearingDate,
 *    lastAmendedDate, historyActions, authors, ...) are overwritten every time
 *    `npm run refresh:legislative` runs against leginfo.legislature.ca.gov.
 *  - Curated fields (stages, alertType, alertNote, badgeLabel, highlight,
 *    policyDeadline) reflect editorial judgment (e.g. "likely dead, confirm
 *    with committee staff") and are edited by hand when something material
 *    changes — the refresh script does not touch them.
 */
export interface TrackedBill {
  id: string; // e.g. "AB-1903"
  billIdParam: string; // leginfo bill_id query param, e.g. "202520260AB1903"
  title: string;
  topic: string;
  tier: string;

  // --- scraped ---
  houseLocation?: string;
  committeeLocation?: string;
  committeeHearingDate?: string; // ISO date, if a hearing is on the calendar
  lastAmendedDate?: string;
  committeeActionDate?: string;
  committeeMotion?: string;
  committeeVoteResult?: string;
  leadAuthors?: string;
  principalCoauthors?: string;
  coauthors?: string;
  historyActions?: BillHistoryAction[];
  lastScraped?: string; // ISO timestamp of last successful refresh

  // --- curated ---
  stages: BillStage[];
  alertType: BillAlertType;
  alertNote: string;
  badgeLabel: string;
  highlight: 'imminent' | 'canceled' | 'none';
  /** ISO date of the relevant 2nd-house policy deadline, used to compute "N days past deadline" banners. */
  policyDeadline?: string;
  sourceUrl: string;
}

export interface DashboardEvent {
  date: string; // ISO date
  dateLabel: { month: string; day: string };
  title: string;
  description: string;
  urgency: 'urgent' | 'soon' | 'deadline' | 'planning' | 'future' | 'canceled';
  badgeLabel?: string;
}

export interface CalendarRow {
  date: string;
  milestone: string;
  status: string;
  state: 'past' | 'imminent' | 'soon' | 'upcoming';
}

export interface PriorityAction {
  policy: string;
  bill: string;
  level: string;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  letterStatus: 'submitted' | 'in_progress' | 'not_started';
  letterStatusLabel: string;
  notes?: string;
}

export interface HighlightNote {
  label: string;
  text: string;
  owner?: string;
  kind: 'action' | 'update' | 'strategy' | 'warning';
}

export interface TeamContact {
  name: string;
  role: string;
  detail: string;
  note?: string;
}

export interface QuickLink {
  label: string;
  url: string;
}

export interface DashboardContent {
  updatedDate: string; // ISO date, set by whoever last edited this file
  events: DashboardEvent[];
  calendar: CalendarRow[];
  tier1Actions: PriorityAction[];
  tier2Actions: PriorityAction[];
  activeActionNotes: HighlightNote[];
  contacts: TeamContact[];
  recentNotes: HighlightNote[];
  quickLinks: QuickLink[];
}
