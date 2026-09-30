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

const STATUS_BADGES: Record<TicketStatus, string> = {
  Open: 'bg-blue-50 text-blue-700 border-blue-200',
  InProgress: 'bg-purple-50 text-purple-700 border-purple-200',
  WaitingForCustomer: 'bg-amber-50 text-amber-700 border-amber-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PRIORITY_BADGES: Record<TicketPriority, string> = {
  Low: 'bg-slate-100 text-slate-600',
  Normal: 'bg-sky-50 text-sky-700',
  High: 'bg-amber-50 text-amber-700',
  Urgent: 'bg-red-50 text-red-700 font-semibold',
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">Support Tickets</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review, reply to, and resolve customer support inquiries.
          </p>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div>
            <label htmlFor="support-search" className="block text-xs font-semibold uppercase text-slate-500">
              Search
            </label>
            <input
              id="support-search"
              type="text"
              placeholder="Search subject or traveler..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="support-status" className="block text-xs font-semibold uppercase text-slate-500">
              Status
            </label>
            <select
              id="support-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="InProgress">In Progress</option>
              <option value="WaitingForCustomer">Waiting for Customer</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="support-category" className="block text-xs font-semibold uppercase text-slate-500">
              Category
            </label>
            <select
              id="support-category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Categories</option>
              <option value="Trip">Trip</option>
              <option value="Payment">Payment</option>
              <option value="Booking">Booking</option>
              <option value="Account">Account</option>
              <option value="App">App</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="support-priority" className="block text-xs font-semibold uppercase text-slate-500">
              Priority
            </label>
            <select
              id="support-priority"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* Assignment */}
          <div>
            <label htmlFor="support-assignment" className="block text-xs font-semibold uppercase text-slate-500">
              Assignment
            </label>
            <select
              id="support-assignment"
              value={assignmentFilter}
              onChange={(e) => {
                setAssignmentFilter(e.target.value as 'all' | 'me' | 'unassigned');
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">All Assignments</option>
              <option value="me">Assigned to Me</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {(statusFilter || categoryFilter || priorityFilter || assignmentFilter !== 'all' || searchQuery) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tickets.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-slate-700">No support tickets found.</p>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery || statusFilter || categoryFilter || priorityFilter || assignmentFilter !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'There are currently no support tickets in the system.'}
          </p>
        </div>
      )}

      {/* Tickets Table */}
      {!loading && !error && tickets.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{ticket.subject}</div>
                      {ticket.packageName && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          Package: {ticket.packageName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {ticket.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          PRIORITY_BADGES[ticket.priority]
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_BADGES[ticket.status]
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {ticket.assignedToId ? (
                        <span className="text-xs font-medium text-slate-800">
                          {ticket.assignedToId === user?.id ? 'Me' : 'Assigned'}
                        </span>
                      ) : (
                        <span className="text-xs italic text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(ticket.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`${basePath}/${ticket.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <span className="text-xs text-slate-500">
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, totalCount)} of {totalCount} tickets
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
