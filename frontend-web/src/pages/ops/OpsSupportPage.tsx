import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { extractErrorMessage } from '../../api/apiClient';
import {
  getSupportTickets,
  type SupportFilterParams,
  type SupportTicketListDto,
  type TicketPriority,
  type TicketStatus,
} from '../../api/support';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, buttonClasses, Card, EmptyState, Input, PageHeader, Select, Skeleton, type BadgeTone } from '../../components/ui';

const STATUS_TONES: Record<TicketStatus, BadgeTone> = {
  Open: 'info',
  InProgress: 'info',
  WaitingForCustomer: 'warning',
  Resolved: 'success',
  Closed: 'neutral',
};

const PRIORITY_TONES: Record<TicketPriority, BadgeTone> = {
  Low: 'neutral',
  Normal: 'info',
  High: 'warning',
  Urgent: 'danger',
};

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

export function OpsSupportPage() {
  const { user } = useAuth();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin/support' : '/ops/support';

  const [tickets, setTickets] = useState<SupportTicketListDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'me' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: SupportFilterParams = {
        page,
        pageSize,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        search: debouncedSearch.trim() || undefined,
      };

      if (assignmentFilter === 'me' && user?.id) {
        params.assignedToId = user.id;
      }

      const res = await getSupportTickets(params);

      let items = res.items;
      if (assignmentFilter === 'unassigned') {
        items = items.filter((t) => !t.assignedToId);
      }

      setTickets(items);
      setTotalCount(res.totalCount);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load support tickets.'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, categoryFilter, priorityFilter, assignmentFilter, debouncedSearch, user?.id]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const resetFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setAssignmentFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasFilters = Boolean(statusFilter || categoryFilter || priorityFilter || assignmentFilter !== 'all' || searchQuery);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        description="Review, reply to, and resolve customer support inquiries."
        className="mb-0"
        actions={
          <Button variant="secondary" onClick={fetchTickets} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            id="support-search"
            type="text"
            label="Search"
            placeholder="Search subject or traveler..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Select
            id="support-status"
            label="Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="InProgress">In Progress</option>
            <option value="WaitingForCustomer">Waiting for Customer</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </Select>

          <Select
            id="support-category"
            label="Category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            <option value="Trip">Trip</option>
            <option value="Payment">Payment</option>
            <option value="Booking">Booking</option>
            <option value="Account">Account</option>
            <option value="App">App</option>
            <option value="Other">Other</option>
          </Select>

          <Select
            id="support-priority"
            label="Priority"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </Select>

          <Select
            id="support-assignment"
            label="Assignment"
            value={assignmentFilter}
            onChange={(e) => {
              setAssignmentFilter(e.target.value as 'all' | 'me' | 'unassigned');
              setPage(1);
            }}
          >
            <option value="all">All Assignments</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
          </Select>
        </div>

        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear all filters
            </Button>
          </div>
        )}
      </Card>

      {error && (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-body font-medium text-danger-fg">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-card border border-border bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <Card padded={false} className="border-dashed">
          <EmptyState
            title="No support tickets found."
            description={
              searchQuery || statusFilter || categoryFilter || priorityFilter || assignmentFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'There are currently no support tickets in the system.'
            }
          />
        </Card>
      )}

      {!loading && !error && tickets.length > 0 && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-caption font-semibold uppercase tracking-wide text-fg-muted">
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="transition hover:bg-surface-sunken">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-fg">{ticket.subject}</div>
                      {ticket.packageName && (
                        <div className="mt-0.5 text-caption text-fg-muted">Package: {ticket.packageName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{ticket.category}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={PRIORITY_TONES[ticket.priority]}>{ticket.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONES[ticket.status]}>{ticket.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {ticket.assignedToId ? (
                        <span className="text-caption font-medium text-fg">
                          {ticket.assignedToId === user?.id ? 'Me' : 'Assigned'}
                        </span>
                      ) : (
                        <span className="text-caption italic text-fg-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-caption text-fg-muted">{formatDateTime(ticket.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`${basePath}/${ticket.id}`} className={buttonClasses('secondary', 'sm')}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-surface-sunken px-4 py-3">
            <span className="text-caption text-fg-muted">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} tickets
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
