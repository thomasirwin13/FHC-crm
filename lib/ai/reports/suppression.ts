import 'server-only';

export interface ContactabilityStats {
  totalMatching: number;
  contactableEmail: number;
  contactableSms: number;
  excluded: number;
}

export type Channel = 'email' | 'sms' | 'whatsapp';

export function applySuppressionFilters(query: any, channel: Channel): any {
  query = query
    .eq('suppressed', false)
    .eq('bounced', false)
    .or('subscription_status.eq.active,subscription_status.is.null')
    .is('unsubscribed_at', null);

  switch (channel) {
    case 'email':
      query = query.not('email', 'is', null).neq('email', '');
      break;
    case 'sms':
    case 'whatsapp':
      query = query
        .not('phone', 'is', null)
        .neq('phone', '')
        .eq('sms_consent', true);
      break;
  }

  return query;
}

export function describeSuppressionRules(channel: Channel): string {
  const base = [
    'Not suppressed',
    'Not bounced',
    'Subscription active or unset',
    'Not unsubscribed',
  ];

  if (channel === 'email') {
    base.push('Has email address');
  } else {
    base.push('Has phone number', 'SMS consent granted');
  }

  return base.join('; ');
}
