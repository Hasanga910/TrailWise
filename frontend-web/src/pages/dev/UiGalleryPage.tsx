import { useState } from 'react';
import { Calendar, Inbox, Plus, Trash2, Users } from 'lucide-react';
import {
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  DataTable,
  DatePicker,
  Drawer,
  DropdownMenu,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  SkeletonText,
  StatCard,
  StatusBadge,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
  Avatar,
  PasswordInput,
  notify,
  STATUS_META,
  type Column,
} from '../../components/ui';
import type { BadgeTone } from '../../components/ui';
import { PasswordStrength } from '../../components/auth/PasswordStrength';
import { useTheme } from '../../theme/useTheme';
import type { BookingStatus } from '../../api/bookings';

interface Row {
  id: string;
  traveler: string;
  pkg: string;
  people: number;
  status: BookingStatus;
}

const ROWS: Row[] = Array.from({ length: 23 }, (_, i) => {
  const statuses = Object.keys(STATUS_META) as BookingStatus[];
  return {
    id: `BK-${1000 + i}`,
    traveler: ['Amaya Silva', 'Ben Carter', 'Chamari Fernando', 'Dev Patel', 'Elena Rossi'][i % 5],
    pkg: ['Hill Country Escape', 'Southern Coast', 'Cultural Triangle'][i % 3],
    people: (i % 6) + 1,
    status: statuses[i % statuses.length],
  };
});

const COLUMNS: Column<Row>[] = [
  { key: 'id', header: 'Booking', cell: (r) => <span className="font-semibold">{r.id}</span>, sortValue: (r) => r.id },
  { key: 'traveler', header: 'Traveler', cell: (r) => r.traveler, sortValue: (r) => r.traveler },
  { key: 'pkg', header: 'Package', cell: (r) => r.pkg, sortValue: (r) => r.pkg },
  { key: 'people', header: 'Guests', cell: (r) => r.people, sortValue: (r) => r.people },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
];

const TONES: BadgeTone[] = ['brand', 'success', 'warning', 'danger', 'info', 'orange', 'neutral'];
const SWATCHES = ['surface', 'surface-raised', 'surface-sunken', 'border', 'fg', 'fg-muted', 'success', 'warning', 'danger', 'info'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-h3 text-fg">{title}</h2>
      <Card className="space-y-4">{children}</Card>
    </section>
  );
}

export function UiGalleryPage() {
  const { preference, setPreference } = useTheme();
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState('one');
  const [on, setOn] = useState(true);
  const [date, setDate] = useState<Date | undefined>();
  const [password, setPassword] = useState('');

  return (
    <>
      <div className="min-h-svh bg-surface-sunken">
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
          <PageHeader
            as="h1"
            title="TrailWise UI gallery"
            description="Every design-system component in the active theme. Development only."
            actions={
              <div className="flex gap-1 rounded-input border border-border bg-surface-raised p-1" role="group" aria-label="Theme">
                {(['system', 'light', 'dark'] as const).map((p) => (
                  <Button key={p} size="sm" variant={preference === p ? 'primary' : 'ghost'} onClick={() => setPreference(p)}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>
            }
          />

          <Section title="Colour tokens">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {SWATCHES.map((t) => (
                <div key={t} className="text-caption">
                  <div className="h-12 rounded-input border border-border" style={{ background: `var(--${t})` }} />
                  <p className="mt-1 font-semibold text-fg">{t}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['bg-brand-50', 'bg-brand-100', 'bg-brand-300', 'bg-brand-500', 'bg-brand-600', 'bg-brand-700', 'bg-brand-900', 'bg-accent-400', 'bg-accent-500', 'bg-accent-600', 'bg-accent-700'].map((c) => (
                <div key={c} className={`h-8 w-12 rounded ${c}`} title={c} />
              ))}
            </div>
          </Section>

          <Section title="Typography">
            <p className="font-heading text-display text-fg">Display</p>
            <p className="font-heading text-h1 text-fg">Heading 1</p>
            <p className="font-heading text-h2 text-fg">Heading 2</p>
            <p className="font-heading text-h3 text-fg">Heading 3</p>
            <p className="font-heading text-h4 text-fg">Heading 4</p>
            <p className="text-body-lg text-fg">Body large: calm, premium Sri Lankan travel.</p>
            <p className="text-body text-fg">Body: the quick brown fox jumps over the lazy dog.</p>
            <p className="text-caption text-fg-muted">Caption: secondary information</p>
            <p className="text-overline text-fg-muted">Overline</p>
          </Section>

          <Section title="Buttons">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>
                Danger
              </Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg" rightIcon={<Plus className="h-5 w-5" />}>
                Large
              </Button>
              <IconButton label="Add item" icon={<Plus className="h-5 w-5" />} variant="secondary" />
              <Tooltip content="Hover or focus me">
                <IconButton label="Delete item" icon={<Trash2 className="h-5 w-5" />} />
              </Tooltip>
            </div>
          </Section>

          <Section title="Form controls">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" placeholder="Amaya Silva" hint="As on your passport" />
              <Input label="Email" type="email" defaultValue="not-an-email" error="Enter a valid email address" />
              <Select label="Tour class" defaultValue="standard">
                <option value="standard">Standard</option>
                <option value="deluxe">Deluxe</option>
                <option value="luxury">Luxury</option>
              </Select>
              <DatePicker label="Start date" value={date} onChange={setDate} minDate={new Date()} />
              <Textarea label="Special requests" placeholder="Anything we should know?" wrapperClassName="sm:col-span-2" />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Checkbox label="Airport pickup" description="Included for groups of 4+" defaultChecked />
              <Checkbox label="Photography add-on" />
              <label className="flex items-center gap-2 text-body text-fg">
                <Switch checked={on} onChange={setOn} label="Email notifications" /> Email notifications
              </label>
            </div>
          </Section>

          <Section title="Password field and strength meter">
            <div className="max-w-sm space-y-2">
              <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Try typing to see the meter move" />
              <PasswordStrength password={password} />
            </div>
          </Section>

          <Section title="Badges and status">
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <Badge key={t} tone={t}>
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_META) as BookingStatus[]).map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Avatar name="Amaya Silva" size="sm" />
              <Avatar name="Ben Carter" size="md" />
              <Avatar name="Chamari Fernando" size="lg" />
            </div>
          </Section>

          <Section title="Cards and stats">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Bookings" value={128} delta={12} hint="vs last month" icon={<Calendar className="h-5 w-5" />} />
              <StatCard label="Revenue" value={482500} format={(n) => `LKR ${Math.round(n).toLocaleString()}`} delta={-3} icon={<Users className="h-5 w-5" />} />
              <StatCard label="Occupancy" value="87%" hint="this week" />
            </div>
            <Card interactive>
              <CardHeader>
                <CardTitle>Interactive card</CardTitle>
                <Badge tone="brand">New</Badge>
              </CardHeader>
              <p className="text-body text-fg-muted">Hover to see the lift.</p>
            </Card>
          </Section>

          <Section title="Tabs, menu, breadcrumbs">
            <Breadcrumbs items={[{ label: 'Ops Portal', to: '/' }, { label: 'Bookings', to: '/' }, { label: 'BK-1001' }]} />
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: 'one', label: 'Overview', content: <p className="text-body text-fg-muted">Overview content</p> },
                { id: 'two', label: 'Itinerary', content: <p className="text-body text-fg-muted">Itinerary content</p> },
                { id: 'three', label: 'Payments', content: <p className="text-body text-fg-muted">Payments content</p> },
              ]}
            />
            <DropdownMenu
              align="start"
              trigger={(p) => (
                <Button variant="secondary" {...p}>
                  Actions
                </Button>
              )}
              items={[
                { heading: 'Booking' },
                { label: 'Approve', onSelect: () => notify.success('Approved') },
                { label: 'Reject', onSelect: () => notify.warning('Rejected') },
                'separator',
                { label: 'Cancel booking', tone: 'danger', onSelect: () => notify.error('Cancelled') },
              ]}
            />
          </Section>

          <Section title="Overlays and toasts">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setModal(true)}>
                Open modal
              </Button>
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                Open drawer
              </Button>
              <Button variant="ghost" onClick={() => notify.success('Payment approved', 'The traveler has been notified.')}>
                Success toast
              </Button>
              <Button variant="ghost" onClick={() => notify.error('Could not save', 'Please try again.')}>
                Error toast
              </Button>
              <Button variant="ghost" onClick={() => notify.info('Heads up')}>
                Info toast
              </Button>
            </div>
          </Section>

          <Section title="Data table">
            <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} pageSize={6} caption="Sample bookings" />
            <DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} emptyTitle="No bookings yet" emptyDescription="New requests will appear here." />
          </Section>

          <Section title="Loading and empty states">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Skeleton className="h-8 w-40" />
                <SkeletonText lines={3} />
              </div>
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="Nothing here yet"
                description="When something needs your attention it will show up here."
                action={<Button size="sm">Create one</Button>}
              />
            </div>
          </Section>
        </div>

        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Confirm cancellation"
          description="This cannot be undone."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(false)}>
                Keep booking
              </Button>
              <Button variant="danger" onClick={() => setModal(false)}>
                Cancel booking
              </Button>
            </>
          }
        >
          <Input label="Reason" placeholder="Optional" />
        </Modal>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Booking BK-1001">
          <div className="space-y-3 p-5">
            <StatusBadge status="Confirmed" />
            <SkeletonText lines={4} />
          </div>
        </Drawer>
      </div>
    </>
  );
}
