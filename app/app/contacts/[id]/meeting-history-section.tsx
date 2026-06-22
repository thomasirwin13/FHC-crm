'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

type MeetingHistoryItem = {
  id: number;
  meeting: { id: number; name: string; date: string; location: string | null } | null;
};

interface MeetingHistorySectionProps {
  initialHistory: MeetingHistoryItem[];
}

export default function MeetingHistorySection({ initialHistory }: MeetingHistorySectionProps) {
  const history = initialHistory.filter(h => h.meeting);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Meeting attendance</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No meetings attended yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/app/meetings/${h.meeting!.id}`} className="font-medium hover:underline">
                    {h.meeting!.name}
                  </Link>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{format(new Date(h.meeting!.date), 'MMM d, yyyy')}</span>
                    {h.meeting!.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{h.meeting!.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
