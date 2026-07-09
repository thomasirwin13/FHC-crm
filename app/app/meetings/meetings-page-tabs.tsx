'use client';

import { useState, ReactNode } from 'react';

const TABS = [
  { id: 'meetings', label: 'Meetings' },
  { id: 'events', label: 'Events & calendar' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function MeetingsPageTabs({
  meetingsContent,
  eventsContent,
}: {
  meetingsContent: ReactNode;
  eventsContent: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>('meetings');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'meetings' && meetingsContent}
      {tab === 'events' && eventsContent}
    </div>
  );
}
