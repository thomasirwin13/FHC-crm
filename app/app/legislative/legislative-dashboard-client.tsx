'use client';

import { useState } from 'react';
import type { TrackedBill, DashboardContent, BillAlertType } from '@/lib/legislative/types';
import styles from './legislative-dashboard.module.css';

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function daysSince(dateLike: string | Date | null | undefined): number | null {
  if (!dateLike) return null;
  const then = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) / msPerDay
  );
}

/** Parses leginfo-style "MM/DD/YY" strings into a Date. */
function parseMmDdYy(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd));
}

const alertClass: Record<BillAlertType, string | undefined> = {
  floor: styles.floorAlert,
  good: styles.goodAlert,
  today: styles.todayAlert,
  canceled: styles.canceledAlert,
  none: undefined,
};

const badgeClass: Record<BillAlertType, string> = {
  floor: styles.badgeFloor,
  good: styles.badgeDone,
  today: styles.badgeUrgent,
  canceled: styles.badgeCanceled,
  none: styles.badgeInfo,
};

const stageClass: Record<string, string> = {
  done: styles.done,
  active: styles.active,
  'active-today': styles.activeToday,
  'floor-now': styles.floorNow,
  future: styles.future,
  canceled: styles.canceledStage,
};

const TABS = [
  { id: 'events', label: '📅 Upcoming Events' },
  { id: 'bills', label: '📋 Bill Timeline' },
  { id: 'actions', label: '✉️ Priority Actions' },
  { id: 'notes', label: '👥 Contacts & Notes' },
] as const;

function BillCardView({ bill }: { bill: TrackedBill }) {
  const mostRecentAction = parseMmDdYy(bill.historyActions?.[0]?.date);
  const daysSinceAction = daysSince(mostRecentAction);
  const daysPastDeadline = daysSince(bill.policyDeadline);

  return (
    <div
      className={cx(
        styles.billCard,
        bill.highlight === 'imminent' && styles.imminent,
        bill.highlight === 'canceled' && styles.canceledCard
      )}
    >
      <div className={styles.billHeader}>
        <span className={styles.billId}>{bill.id}</span>
        <span className={cx(styles.badge, badgeClass[bill.alertType])}>{bill.badgeLabel}</span>
      </div>
      <div className={styles.billTitle}>{bill.title}</div>
      <div className={styles.billStatusLine}>
        {bill.houseLocation} &middot; {bill.committeeLocation || 'Floor'}
        {bill.committeeHearingDate &&
          ` · Hearing: ${new Date(bill.committeeHearingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
      </div>
      {bill.historyActions && bill.historyActions.length > 0 && (
        <div className={styles.billLastAction}>
          {bill.historyActions.map((a, i) => (
            <span key={i}>
              {i > 0 && '  |  '}
              {a.date} &mdash; {a.action}
            </span>
          ))}
        </div>
      )}
      <div className={styles.progressTrack}>
        {bill.stages.map((stage, i) => (
          <div key={i} className={cx(styles.stage, stageClass[stage.status])}>
            {stage.status === 'done' && '✓ '}
            {stage.label}
          </div>
        ))}
      </div>
      {bill.alertNote && (
        <div className={cx(styles.hearingAlert, alertClass[bill.alertType])}>
          {bill.alertNote}
          {daysSinceAction !== null && daysSinceAction > 0 && (
            <> Last action was {daysSinceAction} day{daysSinceAction === 1 ? '' : 's'} ago.</>
          )}
          {daysPastDeadline !== null && daysPastDeadline > 0 && (bill.highlight === 'imminent' || bill.highlight === 'canceled') && (
            <> Now {daysPastDeadline} day{daysPastDeadline === 1 ? '' : 's'} past the 2nd-house policy deadline (Jul 2).</>
          )}
        </div>
      )}
      <div className={styles.leginfoSource}>
        {[bill.leadAuthors, bill.principalCoauthors, bill.coauthors].filter(Boolean).join(' · ')}
        {' · '}
        <a href={bill.sourceUrl} target="_blank" rel="noreferrer">leginfo &rarr;</a>
      </div>
    </div>
  );
}

function getEventBadgeClass(ev: DashboardContent['events'][number]): string {
  if (!ev.badgeLabel) return styles.badgeInfo;
  if (/floor/i.test(ev.badgeLabel)) return styles.badgeFloor;
  if (ev.urgency === 'deadline') return styles.badgeDeadline;
  if (ev.urgency === 'planning') return styles.badgePlanning;
  if (ev.urgency === 'urgent') return styles.badgeUrgent;
  if (ev.urgency === 'soon') return styles.badgeSoon;
  return styles.badgeInfo;
}

function EventCardView({ ev }: { ev: DashboardContent['events'][number] }) {
  return (
    <div className={cx(styles.eventCard, styles[ev.urgency])}>
      <div className={styles.eventDate}>
        <div className={styles.month}>{ev.dateLabel.month}</div>
        <div className={styles.day}>{ev.dateLabel.day}</div>
      </div>
      <div>
        <div className={styles.eventTitle}>
          {ev.title}
          {ev.badgeLabel && (
            <span className={cx(styles.badge, getEventBadgeClass(ev))}>
              {ev.badgeLabel}
            </span>
          )}
        </div>
        <div className={styles.eventDesc}>{ev.description}</div>
      </div>
    </div>
  );
}

export default function LegislativeDashboardClient({
  bills,
  content,
}: {
  bills: TrackedBill[];
  content: DashboardContent;
}) {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('events');

  const urgentEvents = content.events.filter((e) => e.urgency === 'urgent');
  const soonEvents = content.events.filter((e) => e.urgency === 'soon');
  const otherEvents = content.events.filter((e) => e.urgency !== 'urgent' && e.urgency !== 'soon');

  const updatedLabel = new Date(content.updatedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1>Faith &amp; Housing Coalition &mdash; Legislative Tracker</h1>
          <div className={styles.subtitle}>Legislative advocacy &middot; Southern California</div>
        </div>
        <div className={styles.updatedBadge}>Updated {updatedLabel}</div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cx(styles.tabBtn, tab === t.id && styles.tabBtnActive)}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* EVENTS */}
      {tab === 'events' && (
        <div className={styles.tabContent}>
          {urgentEvents.length > 0 && (
            <>
              <div className={styles.sectionTitle}>Today</div>
              {urgentEvents.map((ev, i) => <EventCardView key={i} ev={ev} />)}
            </>
          )}
          {soonEvents.length > 0 && (
            <>
              <div className={styles.sectionTitle}>This Week</div>
              {soonEvents.map((ev, i) => <EventCardView key={i} ev={ev} />)}
            </>
          )}
          {otherEvents.length > 0 && (
            <>
              <div className={styles.sectionTitle}>Upcoming</div>
              {otherEvents.map((ev, i) => <EventCardView key={i} ev={ev} />)}
            </>
          )}

          <div className={styles.sectionTitle}>State Legislative Calendar</div>
          <table className={styles.calTable}>
            <tbody>
              <tr><th>Date</th><th>Milestone</th><th>Status</th></tr>
              {content.calendar.map((row, i) => (
                <tr
                  key={i}
                  className={cx(
                    row.state === 'past' && styles.past,
                    row.state === 'imminent' && styles.imm,
                    row.state === 'soon' && styles.soon,
                    row.state === 'upcoming' && styles.upc
                  )}
                >
                  <td>{row.date}</td>
                  <td><strong>{row.milestone}</strong></td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BILLS */}
      {tab === 'bills' && (
        <div className={styles.tabContent}>
          <div className={styles.sourceLine}>
            Source: leginfo.legislature.ca.gov &middot; Updated {updatedLabel}
          </div>
          {bills.map((bill) => <BillCardView key={bill.id} bill={bill} />)}
        </div>
      )}

      {/* PRIORITY ACTIONS */}
      {tab === 'actions' && (
        <div className={styles.tabContent}>
          {content.activeActionNotes.map((note, i) => (
            <div key={i} className={cx(styles.noteCard, styles[note.kind])}>
              <div className={styles.noteLabel}>{note.label}</div>
              <div className={styles.noteText}>{note.text}</div>
              {note.owner && <div className={styles.noteOwner}>Owner: {note.owner}</div>}
            </div>
          ))}

          <div className={styles.sectionTitle}>Tier 1 &mdash; Core Priorities</div>
          <table className={styles.priorityTable}>
            <tbody>
              <tr><th>Policy</th><th>Bill</th><th>Level</th><th>Letter Status</th></tr>
              {content.tier1Actions.map((row, i) => (
                <tr key={i}>
                  <td><strong>{row.policy}</strong></td>
                  <td>{row.bill}</td>
                  <td>{row.level}</td>
                  <td>
                    <span className={cx(styles.statusDot, row.letterStatus === 'submitted' && styles.dotGreen, row.letterStatus === 'in_progress' && styles.dotAmber, row.letterStatus === 'not_started' && styles.dotGray)} />
                    <span className={cx(styles.tierBadge, styles.tier1)}>Tier 1</span> {row.letterStatusLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.sectionTitle}>Tier 2 &mdash; Family Housing Bills</div>
          <table className={styles.priorityTable}>
            <tbody>
              <tr><th>Bill</th><th>Policy</th><th>Tier</th><th>Letter Status</th><th>Notes</th></tr>
              {content.tier2Actions.map((row, i) => (
                <tr key={i}>
                  <td><strong>{row.bill}</strong></td>
                  <td>{row.policy}</td>
                  <td><span className={cx(styles.tierBadge, styles.tier2)}>Tier 2</span></td>
                  <td>
                    <span className={cx(styles.statusDot, row.letterStatus === 'submitted' && styles.dotGreen, row.letterStatus === 'in_progress' && styles.dotAmber, row.letterStatus === 'not_started' && styles.dotGray)} />
                    {row.letterStatusLabel}
                  </td>
                  <td>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTACTS & NOTES */}
      {tab === 'notes' && (
        <div className={styles.tabContent}>
          <div className={styles.sectionTitle}>Lead Team</div>
          <div className={styles.contactGrid}>
            {content.contacts.map((c, i) => (
              <div key={i} className={styles.contactCard}>
                <div className={styles.contactName}>{c.name}</div>
                <div className={styles.contactRole}>{c.role}</div>
                <div className={styles.contactDetail}>{c.detail}</div>
                {c.note && <div className={styles.contactNote}>{c.note}</div>}
              </div>
            ))}
          </div>

          <div className={styles.sectionTitle}>Recent Updates &amp; Action Items</div>
          {content.recentNotes.map((note, i) => (
            <div key={i} className={cx(styles.noteCard, styles[note.kind])}>
              <div className={styles.noteLabel}>{note.label}</div>
              <div className={styles.noteText}>{note.text}</div>
              {note.owner && <div className={styles.noteOwner}>Owner: {note.owner}</div>}
            </div>
          ))}

          <div className={styles.sectionTitle}>Quick Links</div>
          <div className={styles.quickLinks}>
            {content.quickLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
