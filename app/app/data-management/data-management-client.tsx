'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, AlertCircle, Building2, Mail, Phone, Users, Search, MapPin, User } from 'lucide-react';
import Link from 'next/link';
import { ContactQuickView } from '@/components/contacts/contacts-table';

interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  street?: string | null;
  city?: string;
  state?: string;
  zip?: string | null;
  preferred_contact_method?: string;
  action_committed?: boolean;
  assigned_user_id?: number | null;
  engagement_level?: string | null;
}

interface OrgRow {
  id: number;
  name: string;
  type?: string;
  regions?: string[];
  status?: string;
}

interface TeamMember {
  id: number;
  name: string | null;
  email: string;
}

interface DataManagementClientProps {
  noEmailContacts: Contact[];
  noOrgContacts: Contact[];
  noContactOrgs: OrgRow[];
  allTeamContacts: Contact[];
  allCategories: { id: number; name: string; color: string }[];
  categoryContacts: Record<number, Contact[]>;
  teamMembers: TeamMember[];
}

function ContactTable({
  contacts,
  teamMembers,
  onRowClick,
  organizerFilter,
  onOrganizerFilterChange,
}: {
  contacts: Contact[];
  teamMembers?: TeamMember[];
  onRowClick?: (id: number) => void;
  organizerFilter?: string;
  onOrganizerFilterChange?: (v: string) => void;
}) {
  type SortField = 'name' | 'email' | 'phone' | 'region' | 'weekly' | 'organizer';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  if (contacts.length === 0) return <p className="text-sm text-muted-foreground py-3 px-1">No contacts in this group.</p>;
  const memberMap = teamMembers ? new Map(teamMembers.map((m) => [m.id, m.name || m.email])) : null;
  const dash = '—';

  let displayContacts = contacts;
  if (organizerFilter) {
    const oid = parseInt(organizerFilter, 10);
    displayContacts = displayContacts.filter((c) => c.assigned_user_id === oid);
  }
  if (search) {
    const q = search.toLowerCase();
    displayContacts = displayContacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      ((c as any).regions || []).some((r: string) => r.toLowerCase().includes(q)) ||
      (c.assigned_user_id && memberMap?.get(c.assigned_user_id)?.toLowerCase().includes(q))
    );
  }
  if (sortField) {
    displayContacts = [...displayContacts].sort((a, b) => {
      let aVal: string, bVal: string;
      switch (sortField) {
        case 'organizer':
          aVal = (a.assigned_user_id && memberMap ? memberMap.get(a.assigned_user_id) : '') || '';
          bVal = (b.assigned_user_id && memberMap ? memberMap.get(b.assigned_user_id) : '') || '';
          break;
        case 'email':
          aVal = a.email || ''; bVal = b.email || ''; break;
        case 'phone':
          aVal = a.phone || ''; bVal = b.phone || ''; break;
        case 'region':
          aVal = ((a as any).regions || []).join(', '); bVal = ((b as any).regions || []).join(', '); break;
        case 'weekly':
          aVal = (a as any).action_committed ? '1' : '0'; bVal = (b as any).action_committed ? '1' : '0'; break;
        default:
          aVal = a.name || ''; bVal = b.name || '';
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const {
    paginatedItems: paginatedDisplayContacts,
    page: ctPage, setPage: ctSetPage, pageSize: ctPageSize, setPageSize: ctSetPageSize,
    totalPages: ctTotalPages, totalItems: ctTotalItems, startItem: ctStartItem, endItem: ctEndItem,
  } = usePagination(displayContacts);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden mt-3">
      <div className="flex items-center gap-2 p-2 bg-muted/50 border-b border-border/50">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 text-xs pl-8"
          />
        </div>
        {memberMap && onOrganizerFilterChange && (
          <Select value={organizerFilter || '__all__'} onValueChange={(v) => onOrganizerFilterChange(v === '__all__' ? '' : v)}>
            <SelectTrigger className={`w-48 h-8 text-xs ${organizerFilter ? 'border-primary text-primary' : ''}`}>
              <User className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              <SelectValue placeholder="All organizers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All organizers</SelectItem>
              {teamMembers!.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>{m.name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(search || organizerFilter) && (
          <span className="text-xs text-muted-foreground">{displayContacts.length} result{displayContacts.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr className="border-b border-border">
            {([
              ['name', 'Name', ''],
              ['email', 'Email', 'hidden sm:table-cell'],
              ['phone', 'Phone', 'hidden md:table-cell'],
              ['region', 'Region', 'hidden lg:table-cell'],
              ['weekly', 'Weekly action', 'hidden md:table-cell'],
            ] as [SortField, string, string][]).map(([key, label, hide]) => (
              <th
                key={key}
                className={`text-left p-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none ${hide}`}
                onClick={() => toggleSort(key)}
              >
                {label} {sortField === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
            ))}
            {memberMap && (
              <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort('organizer')}>
                Lead organizer {sortField === 'organizer' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {paginatedDisplayContacts.map((c) => (
            <tr
              key={c.id}
              className={`border-b border-border/50 last:border-0 hover:bg-muted/20 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(c.id) : undefined}
            >
              <td className="p-2.5">
                <Link
                  href={`/app/contacts/${c.id}`}
                  onClick={onRowClick ? (e: React.MouseEvent) => { e.stopPropagation(); } : undefined}
                  className="font-medium hover:underline underline-offset-2"
                >
                  {c.name}
                </Link>
              </td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{c.email || dash}</td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">{c.phone || dash}</td>
              <td className="p-2.5 hidden lg:table-cell">
                {((c as any).regions || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {((c as any).regions as string[]).map((r: string) => (
                      <span key={r} className="inline-flex items-center rounded bg-primary/10 text-primary px-1.5 py-0.5 text-xs">{r}</span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{dash}</span>
                )}
              </td>
              <td className="p-2.5 hidden md:table-cell">
                {c.action_committed ? (
                  <span className="text-emerald-500 font-medium">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </td>
              {memberMap && (
                <td className="p-2.5 text-muted-foreground hidden sm:table-cell">
                  {c.assigned_user_id ? (memberMap.get(c.assigned_user_id) ?? dash) : dash}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {ctTotalItems > ctPageSize && (
        <div className="px-2.5 pb-2">
          <PaginationControls
            page={ctPage}
            totalPages={ctTotalPages}
            pageSize={ctPageSize}
            totalItems={ctTotalItems}
            startItem={ctStartItem}
            endItem={ctEndItem}
            onPageChange={ctSetPage}
            onPageSizeChange={ctSetPageSize}
            compact
          />
        </div>
      )}
    </div>
  );
}

function OrgTable({ orgs }: { orgs: { id: number; name: string; type?: string; regions?: string[]; status?: string }[] }) {
  const {
    paginatedItems: paginatedOrgs,
    page: orgPage, setPage: orgSetPage, pageSize: orgPageSize, setPageSize: orgSetPageSize,
    totalPages: orgTotalPages, totalItems: orgTotalItems, startItem: orgStartItem, endItem: orgEndItem,
  } = usePagination(orgs);

  if (orgs.length === 0) return <p className="text-sm text-muted-foreground py-3 px-1">No organizations in this group.</p>;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden mt-3">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr className="border-b border-border">
            <th className="text-left p-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Region</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {paginatedOrgs.map((o) => (
            <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
              <td className="p-2.5">
                <Link href={`/app/organizations/${o.id}`} className="font-medium hover:underline underline-offset-2">{o.name}</Link>
              </td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{o.type || '—'}</td>
              <td className="p-2.5 text-muted-foreground hidden md:table-cell">{o.regions && o.regions.length ? o.regions.join(', ') : '—'}</td>
              <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{o.status || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orgTotalItems > orgPageSize && (
        <div className="px-2.5 pb-2">
          <PaginationControls
            page={orgPage}
            totalPages={orgTotalPages}
            pageSize={orgPageSize}
            totalItems={orgTotalItems}
            startItem={orgStartItem}
            endItem={orgEndItem}
            onPageChange={orgSetPage}
            onPageSizeChange={orgSetPageSize}
            compact
          />
        </div>
      )}
    </div>
  );
}

function DataQualityRow({
  icon, label, count, expandId, expanded, onToggle, children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  expandId: string;
  expanded: number | string | null;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = expanded === expandId;
  return (
    <Card className="border-border/50">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors rounded-lg"
        onClick={() => onToggle(expandId)}
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
          <Badge variant={count === 0 ? 'secondary' : 'destructive'} className="text-xs">
            {count}
          </Badge>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}

export default function DataManagementClient({
  noEmailContacts,
  noOrgContacts,
  noContactOrgs,
  allTeamContacts,
  allCategories,
  categoryContacts,
  teamMembers,
}: DataManagementClientProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | string | null>(null);
  const [quickViewId, setQuickViewId] = useState<number | null>(null);
  const [reportOrganizerFilter, setReportOrganizerFilter] = useState('');

  const toggle = (id: number | string) =>
    setExpanded((prev) => (prev === id ? null : id));

  // Contacts missing a complete mailing address (street + city + state + ZIP).
  const missingAddress = useMemo(
    () =>
      (allTeamContacts as any[]).filter(
        (c) => !(c.street?.trim() && c.city?.trim() && c.state?.trim() && c.zip?.trim())
      ) as Contact[],
    [allTeamContacts]
  );

  // Contacts with no phone number.
  const noPhone = useMemo(
    () => (allTeamContacts as any[]).filter((c) => !c.phone?.trim()) as Contact[],
    [allTeamContacts]
  );

  // Contacts NOT in a "Newsletter" category
  const notNewsletterSubscribers = useMemo(() => {
    const newsletterCat = allCategories.find((c) => c.name.toLowerCase().includes('newsletter'));
    if (!newsletterCat) return allTeamContacts as Contact[];
    const subscriberIds = new Set((categoryContacts[newsletterCat.id] || []).map((c: Contact) => c.id));
    return (allTeamContacts as Contact[]).filter((c) => !subscriberIds.has(c.id));
  }, [allTeamContacts, allCategories, categoryContacts]);

  // Index all contacts by id for quick-view
  const fullContactById = useMemo(() => {
    const map = new Map<number, any>();
    for (const c of allTeamContacts as any[]) map.set(c.id, c);
    return map;
  }, [allTeamContacts]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <AlertCircle className="h-5 w-5" /> Data quality
      </h2>

      {/* No email */}
      <DataQualityRow
        icon={<Mail className="h-4 w-4" />}
        label="Contacts with no email"
        count={noEmailContacts.length}
        expandId="no-email"
        expanded={expanded}
        onToggle={toggle}
      >
        <ContactTable contacts={noEmailContacts} onRowClick={setQuickViewId} />
      </DataQualityRow>

      {/* No phone */}
      <DataQualityRow
        icon={<Phone className="h-4 w-4" />}
        label="Contacts with no phone"
        count={noPhone.length}
        expandId="no-phone"
        expanded={expanded}
        onToggle={toggle}
      >
        <ContactTable contacts={noPhone} onRowClick={setQuickViewId} />
      </DataQualityRow>

      {/* No organization */}
      <DataQualityRow
        icon={<Building2 className="h-4 w-4" />}
        label="Contacts with no organization"
        count={noOrgContacts.length}
        expandId="no-org"
        expanded={expanded}
        onToggle={toggle}
      >
        <ContactTable contacts={noOrgContacts} onRowClick={setQuickViewId} />
      </DataQualityRow>

      {/* Missing full address */}
      <DataQualityRow
        icon={<MapPin className="h-4 w-4" />}
        label="Contacts missing a full address"
        count={missingAddress.length}
        expandId="no-address"
        expanded={expanded}
        onToggle={toggle}
      >
        <ContactTable contacts={missingAddress} onRowClick={setQuickViewId} />
      </DataQualityRow>

      {/* Not newsletter subscribers */}
      <DataQualityRow
        icon={<Mail className="h-4 w-4" />}
        label="Not a newsletter subscriber"
        count={notNewsletterSubscribers.length}
        expandId="not-newsletter"
        expanded={expanded}
        onToggle={toggle}
      >
        <ContactTable contacts={notNewsletterSubscribers} teamMembers={teamMembers} onRowClick={setQuickViewId} organizerFilter={reportOrganizerFilter} onOrganizerFilterChange={setReportOrganizerFilter} />
      </DataQualityRow>

      {/* Orgs with no contacts */}
      <DataQualityRow
        icon={<Users className="h-4 w-4" />}
        label="Organizations with no contacts"
        count={noContactOrgs.length}
        expandId="no-contacts"
        expanded={expanded}
        onToggle={toggle}
      >
        <OrgTable orgs={noContactOrgs} />
      </DataQualityRow>

      {/* Contact quick-view sheet */}
      {quickViewId && fullContactById.has(quickViewId) && (
        <ContactQuickView
          contact={fullContactById.get(quickViewId)!}
          open={true}
          onOpenChange={(v) => { if (!v) setQuickViewId(null); }}
          categories={allCategories}
          assignmentMap={{}}
          teamMembers={teamMembers}
          organizations={[]}
        />
      )}
    </div>
  );
}
